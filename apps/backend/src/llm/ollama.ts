import type { LLMProvider, ChatMessage } from '@local-voice-agent/shared';
import { createLogger } from '../logger.js';

const log = createLogger('ollama');

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
}

interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  total_duration?: number;
}

interface OllamaTagsResponse {
  models: Array<{ name: string; size: number; modified_at: string }>;
}

export class OllamaProvider implements LLMProvider {
  private url: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(url: string, model: string, temperature = 0.3, maxTokens = 256) {
    this.url = url.replace(/\/$/, '');
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
  }

  async *generate(prompt: string): AsyncIterable<string> {
    const startTime = Date.now();
    log.debug('Generating response', { model: this.model, promptLength: prompt.length });

    const response = await fetch(`${this.url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: true,
        options: {
          temperature: this.temperature,
          num_predict: this.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama generate failed (${response.status}): ${text}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body from Ollama');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as OllamaGenerateResponse;
            if (parsed.response) {
              yield parsed.response;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
      const elapsed = Date.now() - startTime;
      log.debug(`Generation completed in ${elapsed}ms`);
    }
  }

  async *chat(messages: ChatMessage[]): AsyncIterable<string> {
    const startTime = Date.now();
    log.debug('Chat request', { model: this.model, messageCount: messages.length });

    const response = await fetch(`${this.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
        options: {
          temperature: this.temperature,
          num_predict: this.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama chat failed (${response.status}): ${text}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body from Ollama');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as OllamaChatResponse;
            if (parsed.message?.content) {
              yield parsed.message.content;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
      const elapsed = Date.now() - startTime;
      log.debug(`Chat completed in ${elapsed}ms`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.url}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getModelName(): string {
    return this.model;
  }

  setModel(model: string): void {
    this.model = model;
    log.info(`Model changed to ${model}`);
  }

  setTemperature(temp: number): void {
    this.temperature = temp;
  }

  setMaxTokens(tokens: number): void {
    this.maxTokens = tokens;
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.url}/api/tags`);
      if (!response.ok) return [];
      const data = (await response.json()) as OllamaTagsResponse;
      return data.models.map(m => m.name);
    } catch {
      return [];
    }
  }

  async pullModel(model: string): Promise<void> {
    log.info(`Pulling model ${model}...`);
    const response = await fetch(`${this.url}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: false }),
    });
    if (!response.ok) {
      throw new Error(`Failed to pull model ${model}`);
    }
    log.info(`Model ${model} pulled successfully`);
  }
}
