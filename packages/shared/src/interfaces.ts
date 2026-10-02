import type { ChatMessage, Transcript, SearchResult } from './types.js';

// ─── Provider Interfaces ───────────────────────────────────────────
// All providers are abstract so implementations can be swapped.

/**
 * Audio capture provider.
 * Emits audio chunks for processing.
 */
export interface AudioProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  isActive(): boolean;
  getDevices(): Promise<Array<{ id: string; name: string; type: string }>>;
  setDevice(deviceId: string): Promise<void>;
  onAudioChunk(callback: (chunk: Buffer, sampleRate: number) => void): void;
  removeAllListeners(): void;
}

/**
 * Speech-to-text provider.
 * Takes audio buffers and produces transcripts.
 */
export interface STTProvider {
  initialize(): Promise<void>;
  transcribe(audioBuffer: Buffer, sampleRate: number): Promise<Transcript>;
  isReady(): boolean;
  getModelInfo(): { name: string; size: string };
  dispose(): Promise<void>;
}

/**
 * Large language model provider.
 * Supports both one-shot generation and streaming chat.
 */
export interface LLMProvider {
  generate(prompt: string): AsyncIterable<string>;
  chat(messages: ChatMessage[]): AsyncIterable<string>;
  isAvailable(): Promise<boolean>;
  getModelName(): string;
  listModels(): Promise<string[]>;
}

/**
 * Web search provider.
 * Returns search results for a query.
 */
export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>;
  isAvailable(): Promise<boolean>;
  getName(): string;
}

/**
 * Text-to-speech provider.
 * Speaks text aloud.
 */
export interface TTSProvider {
  speak(text: string): Promise<void>;
  stop(): Promise<void>;
  isSpeaking(): boolean;
  getVoices(): Promise<string[]>;
  setVoice(voice: string): void;
  setSpeed(speed: number): void;
}
