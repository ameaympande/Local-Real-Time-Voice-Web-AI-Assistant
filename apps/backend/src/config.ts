import type { AppSettings } from '@local-voice-agent/shared';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenvConfig({ path: resolve(__dirname, '../../../.env') });

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val === 'true' || val === '1';
}

function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function envFloat(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? fallback : parsed;
}

export const defaultSettings: AppSettings = {
  general: {
    startOnLogin: false,
    minimizeToTray: true,
    theme: 'dark',
    overlayOpacity: 0.95,
    compactMode: false,
  },
  audio: {
    source: 'microphone',
    sampleRate: 16000,
    channels: 1,
    chunkDurationMs: 1000,
    vadSensitivity: 0.4,
    silenceTimeoutMs: 400,
  },
  stt: {
    model: 'base',
    language: 'en',
    chunkDurationMs: 1000,
    binaryPath: env('WHISPER_BINARY_PATH', ''),
    modelsDir: env('WHISPER_MODELS_DIR', ''),
  },
  llm: {
    provider: 'ollama',
    url: env('OLLAMA_URL', 'http://localhost:11434'),
    model: env('OLLAMA_MODEL', 'qwen2.5:3b'),
    temperature: envFloat('OLLAMA_TEMPERATURE', 0.3),
    maxTokens: envInt('OLLAMA_MAX_TOKENS', 256),
  },
  search: {
    enabled: envBool('SEARCH_ENABLED', true),
    provider: env('SEARCH_PROVIDER', 'duckduckgo'),
    maxResults: envInt('SEARCH_MAX_RESULTS', 5),
    timeoutMs: envInt('SEARCH_TIMEOUT', 10000),
  },
  tts: {
    enabled: envBool('TTS_ENABLED', false),
    voice: env('TTS_VOICE', 'Samantha'),
    speed: envInt('TTS_SPEED', 175),
  },
  shortcuts: {
    toggleListening: 'CommandOrControl+Shift+Space',
    showHide: 'CommandOrControl+Shift+A',
    clearConversation: 'CommandOrControl+Shift+C',
    stopListening: 'CommandOrControl+Shift+S',
  },
  privacy: {
    logConversations: envBool('LOG_CONVERSATIONS', false),
  },
  context: {
    maxTurns: 20,
  },
};

export const serverConfig = {
  port: envInt('BACKEND_PORT', 3399),
  host: env('BACKEND_HOST', 'localhost'),
  debug: envBool('DEBUG', false),
};
