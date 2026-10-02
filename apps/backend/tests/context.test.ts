import { describe, it, expect } from 'vitest';
import { ConversationContext } from '../src/agent/context.js';

describe('ConversationContext', () => {
  it('should add and retrieve messages', () => {
    const ctx = new ConversationContext(10);
    ctx.addUserMessage('What is NestJS?');
    ctx.addAssistantMessage('NestJS is a Node.js framework.');

    const messages = ctx.getMessages();
    // system + user + assistant = 3
    expect(messages.length).toBe(3);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[2].role).toBe('assistant');
  });

  it('should trim to max turns', () => {
    const ctx = new ConversationContext(2);
    // Add 5 turns
    for (let i = 0; i < 5; i++) {
      ctx.addUserMessage(`Question ${i}`);
      ctx.addAssistantMessage(`Answer ${i}`);
    }

    const messages = ctx.getMessages();
    // system + 2 turns (4 messages) = 5
    expect(messages.length).toBe(5);
    // Should keep the latest turns
    expect(messages[1].content).toBe('Question 3');
  });

  it('should return last user message', () => {
    const ctx = new ConversationContext(10);
    ctx.addUserMessage('First question');
    ctx.addAssistantMessage('First answer');
    ctx.addUserMessage('Second question');

    expect(ctx.getLastUserMessage()).toBe('Second question');
  });

  it('should clear all messages', () => {
    const ctx = new ConversationContext(10);
    ctx.addUserMessage('Test');
    ctx.clear();

    // Only system prompt should remain
    expect(ctx.getMessages().length).toBe(1);
  });

  it('should inject web context', () => {
    const ctx = new ConversationContext(10);
    ctx.addUserMessage('What is the latest React version?');

    const messages = ctx.getMessagesWithContext('React 18.2 is the latest.');
    // system + web context system + user = 3
    expect(messages.length).toBe(3);
    // The web context should be a system message
    const webCtx = messages.find(m => m.content.includes('React 18.2'));
    expect(webCtx).toBeDefined();
    expect(webCtx!.role).toBe('system');
  });
});
