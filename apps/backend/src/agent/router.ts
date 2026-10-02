import type { RouterDecision, LLMProvider } from '@local-voice-agent/shared';
import { createLogger } from '../logger.js';

const log = createLogger('router');

/**
 * AgentRouter decides whether a transcript requires:
 * 1. Local LLM answer
 * 2. Web search + LLM answer
 * 3. Should be ignored (not a question, just chatter)
 * 
 * Uses a fast heuristic first, then optionally the LLM for ambiguous cases.
 */
export class AgentRouter {
  private llm: LLMProvider | null = null;
  private useLLMForRouting = false;

  constructor(llm?: LLMProvider, useLLMForRouting = false) {
    this.llm = llm ?? null;
    this.useLLMForRouting = useLLMForRouting;
  }

  setLLM(llm: LLMProvider): void {
    this.llm = llm;
  }

  /**
   * Route a transcript to the appropriate action.
   * Fast heuristic-based routing to minimize latency.
   */
  async route(text: string): Promise<RouterDecision> {
    const trimmed = text.trim();

    // Too short to be meaningful
    if (trimmed.length < 5) {
      return { action: 'ignore', reason: 'too_short' };
    }

    // Check if it looks like a question or request
    if (!this.looksLikeQuestion(trimmed)) {
      return { action: 'ignore', reason: 'not_a_question' };
    }

    // Check if it needs current/time-sensitive information
    if (this.needsCurrentInfo(trimmed)) {
      const searchQuery = this.extractSearchQuery(trimmed);
      return {
        action: 'web_search',
        reason: 'current_information',
        query: trimmed,
        searchQuery,
      };
    }

    // For ambiguous cases, optionally use LLM for routing
    if (this.useLLMForRouting && this.llm) {
      return await this.routeWithLLM(trimmed);
    }

    // Default: answer locally
    return {
      action: 'local_answer',
      reason: 'stable_knowledge',
      query: trimmed,
    };
  }

  /**
   * Heuristic: does this look like a question or request?
   */
  private looksLikeQuestion(text: string): boolean {
    const lower = text.toLowerCase();

    // Question patterns
    const questionPatterns = [
      /\?$/,                          // Ends with ?
      /^(what|who|where|when|why|how|which|is|are|can|could|would|should|do|does|did|will|has|have)/i,
      /\b(explain|describe|tell me|show me|help me|define|compare)\b/i,
      /\b(what is|what are|what was|what were|how to|how do|how does|how can)\b/i,
    ];

    if (questionPatterns.some(p => p.test(lower))) {
      return true;
    }

    // Ignore patterns (casual conversation, greetings, etc.)
    const ignorePatterns = [
      /^(hey|hi|hello|good morning|good afternoon|good evening|bye|goodbye|thanks|thank you|ok|okay|sure|yeah|yes|no|alright|cool|nice|great|awesome|wow)\b/i,
      /^(let's|we should|we need to|let me|hold on|wait|one second|hang on)\b/i,
      /^(so|well|um|uh|hmm|huh)\b/i,
    ];

    // If it matches ignore AND it's short, ignore it
    if (ignorePatterns.some(p => p.test(lower)) && text.length < 30) {
      return false;
    }

    // Longer text that doesn't match ignore patterns → treat as potential question
    return text.length > 15;
  }

  /**
   * Heuristic: does this need up-to-date information?
   */
  private needsCurrentInfo(text: string): boolean {
    const lower = text.toLowerCase();

    const currentInfoPatterns = [
      /\b(latest|newest|current|recent|today|now|2024|2025|2026|this year|this month|this week)\b/,
      /\b(price|stock|weather|news|score|release|update|version)\b.*\b(now|today|latest|current)\b/,
      /\b(now|today|latest|current)\b.*\b(price|stock|weather|news|score|release|update|version)\b/,
      /\bwhat is the (latest|current|newest)\b/,
      /\bhow much (does|is)\b.*\b(cost|worth)\b/,
      /\b(latest|current|new) version\b/,
      /\brelease date\b/,
    ];

    return currentInfoPatterns.some(p => p.test(lower));
  }

  /**
   * Extract a clean search query from the text.
   */
  private extractSearchQuery(text: string): string {
    // Remove filler words for better search
    return text
      .replace(/\b(please|can you|could you|tell me|what is|what are|what's)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || text;
  }

  /**
   * Use the LLM to decide routing for ambiguous cases.
   * This is slower but more accurate.
   */
  private async routeWithLLM(text: string): Promise<RouterDecision> {
    if (!this.llm) {
      return { action: 'local_answer', reason: 'no_llm_for_routing', query: text };
    }

    const prompt = `Classify this text. Respond with ONLY one word: "local", "web", or "ignore".

"local" = question that can be answered with general knowledge
"web" = needs current/real-time information from the internet
"ignore" = not a question, just casual speech

Text: "${text}"

Classification:`;

    try {
      let response = '';
      for await (const chunk of this.llm.generate(prompt)) {
        response += chunk;
        if (response.length > 20) break; // We only need one word
      }

      const classification = response.trim().toLowerCase();
      log.debug(`LLM routing: "${text.substring(0, 40)}..." → ${classification}`);

      if (classification.includes('web')) {
        return {
          action: 'web_search',
          reason: 'llm_classified_web',
          query: text,
          searchQuery: this.extractSearchQuery(text),
        };
      }
      if (classification.includes('ignore')) {
        return { action: 'ignore', reason: 'llm_classified_ignore' };
      }
      return { action: 'local_answer', reason: 'llm_classified_local', query: text };
    } catch (error) {
      log.error('LLM routing failed, defaulting to local', { error: (error as Error).message });
      return { action: 'local_answer', reason: 'routing_fallback', query: text };
    }
  }
}
