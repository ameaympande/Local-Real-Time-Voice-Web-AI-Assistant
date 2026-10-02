import type { ChatMessage } from '@local-voice-agent/shared';
import { createLogger } from '../logger.js';

const log = createLogger('context');

/**
 * ConversationContext maintains a sliding window of conversation turns.
 * Keeps memory small for low-latency responses.
 */
export class ConversationContext {
  private messages: ChatMessage[] = [];
  private maxTurns: number;
  private systemPrompt: string;

  constructor(maxTurns = 20) {
    this.maxTurns = maxTurns;
    this.systemPrompt = [
      'You are a senior technical interviewer and expert coding mentor conducting a highly realistic mock interview.',
      'Your expertise deeply covers JavaScript, React, NestJS, Git, and modern web development architectures.',
      'Your tone should be human-like, conversational, and highly engaging, as if you are a senior engineer pair-programming or interviewing the user.',
      'When asked a technical question or asked to explain a concept, provide GOOD, LONG, DETAILED responses. Explain the "why" and "how" deeply.',
      'When asked how to do something (e.g., installing Git, setting up a project), provide incredibly clear, step-by-step instructions.',
      'When the user answers an interview question, evaluate their answer, provide detailed feedback, and then ask a thought-provoking follow-up question.',
      'Always break down complex concepts into easily understandable, detailed explanations.',
      'Do not add robotic preamble or filler words like "As an AI". Act like a real human engineer.',
    ].join(' ');
  }

  addUserMessage(text: string): void {
    this.messages.push({ role: 'user', content: text });
    this.trimIfNeeded();
    log.debug(`Context: ${this.messages.length} messages`);
  }

  addAssistantMessage(text: string): void {
    this.messages.push({ role: 'assistant', content: text });
    this.trimIfNeeded();
  }

  /**
   * Build the full message array for the LLM, including system prompt.
   */
  getMessages(): ChatMessage[] {
    return [
      { role: 'system', content: this.systemPrompt },
      ...this.messages,
    ];
  }

  /**
   * Build messages with additional context (e.g., web search results).
   */
  getMessagesWithContext(additionalContext: string): ChatMessage[] {
    const lastMessage = this.messages[this.messages.length - 1];
    const enrichedMessages = this.messages.slice(0, -1);

    // Add web context as a system message before the user's question
    enrichedMessages.push({
      role: 'system',
      content: `Use the following information to answer the user's question. Include source URLs when relevant.\n\n${additionalContext}`,
    });

    if (lastMessage) {
      enrichedMessages.push(lastMessage);
    }

    return [
      { role: 'system', content: this.systemPrompt },
      ...enrichedMessages,
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

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  private trimIfNeeded(): void {
    // Each turn = 1 user + 1 assistant message = 2 entries
    const maxMessages = this.maxTurns * 2;
    if (this.messages.length > maxMessages) {
      this.messages = this.messages.slice(this.messages.length - maxMessages);
    }
  }
}
