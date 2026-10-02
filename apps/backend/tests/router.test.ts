import { describe, it, expect } from 'vitest';
import { AgentRouter } from '../src/agent/router.js';

describe('AgentRouter', () => {
  const router = new AgentRouter();

  describe('looksLikeQuestion detection', () => {
    it('should detect direct questions', async () => {
      const result = await router.route('What is dependency injection in NestJS?');
      expect(result.action).not.toBe('ignore');
    });

    it('should detect how-to questions', async () => {
      const result = await router.route('How do I install Node.js on macOS?');
      expect(result.action).not.toBe('ignore');
    });

    it('should detect explain requests', async () => {
      const result = await router.route('Explain the difference between REST and GraphQL');
      expect(result.action).not.toBe('ignore');
    });

    it('should ignore casual greetings', async () => {
      const result = await router.route('Hey everyone');
      expect(result.action).toBe('ignore');
    });

    it('should ignore short casual speech', async () => {
      const result = await router.route('Ok sure');
      expect(result.action).toBe('ignore');
    });

    it('should ignore "let\'s take a break"', async () => {
      const result = await router.route("Let's take a break");
      expect(result.action).toBe('ignore');
    });

    it('should ignore very short text', async () => {
      const result = await router.route('Hi');
      expect(result.action).toBe('ignore');
    });
  });

  describe('current info detection', () => {
    it('should route "latest version" to web search', async () => {
      const result = await router.route('What is the latest version of React?');
      expect(result.action).toBe('web_search');
      expect(result.reason).toBe('current_information');
    });

    it('should route "current price" to web search', async () => {
      const result = await router.route('What is the current price of Bitcoin?');
      expect(result.action).toBe('web_search');
    });

    it('should route year-specific questions to web search', async () => {
      const result = await router.route('What happened in tech news today?');
      expect(result.action).toBe('web_search');
    });

    it('should route stable knowledge locally', async () => {
      const result = await router.route('What is dependency injection?');
      expect(result.action).toBe('local_answer');
      expect(result.reason).toBe('stable_knowledge');
    });

    it('should route conceptual questions locally', async () => {
      const result = await router.route('How does a binary search tree work?');
      expect(result.action).toBe('local_answer');
    });
  });

  describe('search query extraction', () => {
    it('should produce a search query for web searches', async () => {
      const result = await router.route('What is the latest version of Node.js?');
      expect(result.searchQuery).toBeDefined();
      expect(result.searchQuery!.length).toBeGreaterThan(0);
    });
  });
});
