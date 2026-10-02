import type { SearchProvider, SearchResult } from '@local-voice-agent/shared';
import { createLogger } from '../logger.js';

const log = createLogger('duckduckgo');

/**
 * DuckDuckGo search provider using the HTML lite endpoint.
 * No API key required. Respects rate limits.
 */
export class DuckDuckGoProvider implements SearchProvider {
  private maxResults: number;
  private timeoutMs: number;
  private lastRequestTime = 0;
  private minRequestIntervalMs = 2000; // Rate limiting

  constructor(maxResults = 5, timeoutMs = 10000) {
    this.maxResults = maxResults;
    this.timeoutMs = timeoutMs;
  }

  async search(query: string): Promise<SearchResult[]> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestIntervalMs) {
      await new Promise(r => setTimeout(r, this.minRequestIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();

    log.debug(`Searching: "${query}"`);

    try {
      // Use DuckDuckGo HTML lite
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const html = await response.text();
      return this.parseResults(html);
    } catch (error) {
      log.error('Search failed', { error: (error as Error).message });
      return [];
    }
  }

  private parseResults(html: string): SearchResult[] {
    const results: SearchResult[] = [];

    // Parse DuckDuckGo HTML lite results using regex (avoid heavy cheerio for simple parsing)
    // Each result is in a div with class "result"
    const resultBlocks = html.match(/<div class="links_main links_deep result__body">[\s\S]*?<\/div>/g) || [];

    // Alternative: parse the simpler structure
    const titleRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

    const titles: Array<{ url: string; title: string }> = [];
    let match;

    while ((match = titleRegex.exec(html)) !== null && titles.length < this.maxResults) {
      const rawUrl = match[1];
      const title = this.stripHtml(match[2]).trim();

      // DuckDuckGo wraps URLs in a redirect, extract the actual URL
      const actualUrl = this.extractUrl(rawUrl);
      if (actualUrl && title) {
        titles.push({ url: actualUrl, title });
      }
    }

    const snippets: string[] = [];
    while ((match = snippetRegex.exec(html)) !== null) {
      snippets.push(this.stripHtml(match[1]).trim());
    }

    for (let i = 0; i < titles.length && i < this.maxResults; i++) {
      results.push({
        title: titles[i].title,
        url: titles[i].url,
        snippet: snippets[i] || '',
      });
    }

    log.debug(`Found ${results.length} results`);
    return results;
  }

  private extractUrl(ddgUrl: string): string {
    // DuckDuckGo redirects: //duckduckgo.com/l/?uddg=<encoded_url>&...
    const match = ddgUrl.match(/uddg=([^&]*)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
    // Direct URL
    if (ddgUrl.startsWith('http')) {
      return ddgUrl;
    }
    if (ddgUrl.startsWith('//')) {
      return `https:${ddgUrl}`;
    }
    return ddgUrl;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://duckduckgo.com/', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getName(): string {
    return 'DuckDuckGo';
  }
}
