import type { SearchResult, RetrievedContent } from '@local-voice-agent/shared';
import { createLogger } from '../logger.js';

const log = createLogger('retrieval');

/**
 * WebRetriever fetches and extracts relevant content from search results.
 * Minimizes the amount of text sent to the LLM.
 */
export class WebRetriever {
  private maxContentLength = 2000; // Max chars per page
  private maxTotalContent = 5000;  // Max total chars for LLM context
  private timeoutMs = 8000;

  /**
   * Retrieve and clean content from search results.
   * Only fetches the top results to save bandwidth/time.
   */
  async retrieve(results: SearchResult[], maxPages = 3): Promise<RetrievedContent[]> {
    const pages = results.slice(0, maxPages);
    const retrieved: RetrievedContent[] = [];
    let totalContent = 0;

    const promises = pages.map(async (result) => {
      try {
        const content = await this.fetchAndExtract(result.url);
        return {
          url: result.url,
          title: result.title,
          content: content.substring(0, this.maxContentLength),
          snippet: result.snippet,
        };
      } catch (error) {
        log.debug(`Failed to retrieve ${result.url}: ${(error as Error).message}`);
        // Fall back to snippet
        return {
          url: result.url,
          title: result.title,
          content: result.snippet,
          snippet: result.snippet,
        };
      }
    });

    const results_resolved = await Promise.allSettled(promises);

    for (const result of results_resolved) {
      if (result.status === 'fulfilled' && result.value.content) {
        if (totalContent + result.value.content.length > this.maxTotalContent) {
          // Truncate to fit budget
          const remaining = this.maxTotalContent - totalContent;
          if (remaining > 100) {
            result.value.content = result.value.content.substring(0, remaining);
            retrieved.push(result.value);
          }
          break;
        }
        totalContent += result.value.content.length;
        retrieved.push(result.value);
      }
    }

    log.debug(`Retrieved ${retrieved.length} pages, ${totalContent} chars total`);
    return retrieved;
  }

  /**
   * Fetch a URL and extract clean text content.
   */
  private async fetchAndExtract(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return this.extractText(html);
  }

  /**
   * Extract readable text from HTML.
   * Simple extraction without heavy dependencies.
   */
  private extractText(html: string): string {
    // Remove script and style tags
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '');

    // Extract text from remaining HTML
    text = text
      .replace(/<[^>]*>/g, ' ')  // Strip tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();

    return text;
  }

  /**
   * Format retrieved content for LLM context.
   */
  formatForLLM(contents: RetrievedContent[]): string {
    if (contents.length === 0) return '';

    const sections = contents.map((c, i) => {
      return `[Source ${i + 1}: ${c.title}]\nURL: ${c.url}\n${c.content}`;
    });

    return `Web Search Results:\n\n${sections.join('\n\n---\n\n')}`;
  }
}
