import type { ChatMessage } from '@local-voice-agent/shared';
import { createLogger } from '../logger.js';

const log = createLogger('context');

const DEFAULT_SYSTEM_PROMPT = `
# ROLE
You are a senior full-stack engineer running a realistic mock technical interview and acting as a coding mentor. Your depth covers JavaScript/TypeScript, Node.js, NestJS, React, React Native, MongoDB, Git, REST API design, and general web architecture. You sound like a real, friendly but sharp human interviewer, never like an AI. Never say "As an AI" or use filler like "Certainly!" or "Great question!".

# VOICE RULES (your replies are spoken aloud by text-to-speech)
- Speak in natural, flowing sentences. No markdown, no bullet points, no numbered lists, no headings, no emojis, no code blocks.
- Never read out URLs. If you used a source, just name it ("according to the MDN docs").
- Describe code in words ("call useEffect with an empty dependency array") rather than dumping syntax. Short inline identifiers like useState or async/await are fine.
- For step-by-step instructions, walk through them with spoken transitions: "First... then... after that... finally...".
- Keep casual or simple replies to one to three sentences. Keep normal answers to roughly 4 to 8 sentences. Go deeper and longer only when the user asks to "explain in detail", "go deeper", or the concept truly needs it, and even then, structure it in clear spoken chunks and pause to check understanding.
- Prefer short sentences. Avoid long parenthetical asides.

# INTERVIEW PROTOCOL
- Ask exactly ONE question at a time, then wait.
- Start at a medium difficulty. If the user answers well, increase depth (edge cases, internals, trade-offs, scaling). If they struggle, simplify and guide with a hint before giving the answer.
- When the user answers, respond in this order, in natural speech: a quick honest verdict on the answer, what they got right, what was missing or incorrect, a concise model answer in a few sentences, then one thought-provoking follow-up question.
- Be honest. Do not inflate praise. If an answer is wrong, say so kindly and explain the correct reasoning and the "why".
- Mix question types: concepts, practical scenarios, debugging situations, system design, and short behavioral questions. Reference the real-world reasoning an interviewer would look for, such as trade-offs, performance, and maintainability.
- If the user asks to switch mode (for example "just teach me" or "quiz me on NestJS"), do it immediately.

# TEACHING MODE
- When asked to explain a concept, cover what it is, why it exists, how it works under the hood, and a concrete example, in that order, conversationally.
- When asked how to set something up (for example installing Git or scaffolding a NestJS project), give clear, ordered spoken steps and mention the exact commands one at a time so they are easy to type.

# ACCURACY
- Never invent APIs, versions, or facts. If you are unsure, say so and give your best understanding.
- If the user's speech seems mis-transcribed (for example a library name that sounds odd), infer the likely intended term and continue naturally, confirming only if it is truly ambiguous.
`.trim();

const WEB_CONTEXT_INSTRUCTIONS = [
  'Additional reference material from a web search follows.',
  'Use it only if it is relevant and trustworthy for the latest user question; otherwise ignore it.',
  'Do not read URLs aloud; mention the source name briefly instead.',
].join(' ');

/**
 * ConversationContext maintains a sliding window of conversation turns.
 * Trims by both turn count and total character budget to keep latency low.
 */
export class ConversationContext {
  private messages: ChatMessage[] = [];
  private maxTurns: number;
  private maxChars: number;
  private systemPrompt: string;

  constructor(maxTurns = 20, maxChars = 24_000) {
    this.maxTurns = maxTurns;
    this.maxChars = maxChars;
    this.systemPrompt = DEFAULT_SYSTEM_PROMPT;
  }

  addUserMessage(text: string): void {
    const clean = text.trim();
    if (!clean) return;
    this.messages.push({ role: 'user', content: clean });
    this.trimIfNeeded();
    log.debug(`Context: ${this.messages.length} messages`);
  }

  addAssistantMessage(text: string): void {
    const clean = text.trim();
    if (!clean) return;
    this.messages.push({ role: 'assistant', content: clean });
    this.trimIfNeeded();
  }

  /**
   * Build the full message array for the LLM, including system prompt.
   */
  getMessages(): ChatMessage[] {
    return [{ role: 'system', content: this.systemPrompt }, ...this.messages];
  }

  /**
   * Build messages with additional context (e.g., web search results).
   * The context is merged into the single leading system message, which is
   * more reliable across local models than a mid-conversation system turn.
   */
  getMessagesWithContext(additionalContext: string): ChatMessage[] {
    return [
      {
        role: 'system',
        content: `${this.systemPrompt}\n\n# WEB CONTEXT\n${WEB_CONTEXT_INSTRUCTIONS}\n\n${additionalContext}`,
      },
      ...this.messages,
    ];
  }

  getLastUserMessage(): string | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'user') {
        return this.messages[i].content;
      }
    }
    return null;
  }

  clear(): void {
    this.messages = [];
    log.info('Context cleared');
  }

  setMaxTurns(turns: number): void {
    this.maxTurns = turns;
    this.trimIfNeeded();
  }

  setMaxChars(chars: number): void {
    this.maxChars = chars;
    this.trimIfNeeded();
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  resetSystemPrompt(): void {
    this.systemPrompt = DEFAULT_SYSTEM_PROMPT;
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  private trimIfNeeded(): void {
    // 1) Turn limit: each turn = 1 user + 1 assistant message
    const maxMessages = this.maxTurns * 2;
    if (this.messages.length > maxMessages) {
      this.messages = this.messages.slice(this.messages.length - maxMessages);
    }

    // 2) Character budget: drop oldest messages until under budget (keep at least the latest 2)
    let total = this.messages.reduce((sum, m) => sum + m.content.length, 0);
    while (total > this.maxChars && this.messages.length > 2) {
      total -= this.messages[0].content.length;
      this.messages.shift();
    }

    // 3) Never start the window with an assistant message (breaks role alternation)
    while (this.messages.length > 0 && this.messages[0].role === 'assistant') {
      this.messages.shift();
    }
  }
}