// ─── Audio Types ───────────────────────────────────────────────────

export type AudioSourceType = 'microphone' | 'system' | 'both';

export interface AudioDevice {
  id: string;
  name: string;
  type: AudioSourceType;
  sampleRate?: number;
  channels?: number;
}

export interface AudioConfig {
  source: AudioSourceType;
  deviceId?: string;
  sampleRate: number;
  channels: number;
  chunkDurationMs: number;
}

export interface AudioChunk {
  data: Float32Array | Int16Array;
  sampleRate: number;
  channels: number;
  timestamp: number;
  duration: number;
}

// ─── VAD Types ─────────────────────────────────────────────────────

export interface VADConfig {
  sensitivity: number; // 0.0 - 1.0
  silenceTimeoutMs: number;
  minSpeechDurationMs: number;
}

export interface VADEvent {
  type: 'speech_start' | 'speech_end' | 'speech_active';
  timestamp: number;
  confidence?: number;
}

// ─── STT Types ─────────────────────────────────────────────────────

export type STTModelSize = 'tiny' | 'base' | 'small';

export interface STTConfig {
  model: STTModelSize;
  language: string;
  chunkDurationMs: number;
  binaryPath?: string;
  modelsDir?: string;
}

export interface Transcript {
  text: string;
  isFinal: boolean;
  confidence?: number;
  timestamp: number;
  duration?: number;
}

// ─── LLM Types ─────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMConfig {
  provider: string;
  url: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface LLMResponse {
  text: string;
  done: boolean;
  model?: string;
  totalDuration?: number;
}

// ─── Agent / Router Types ──────────────────────────────────────────

export type AgentAction = 'local_answer' | 'web_search' | 'ignore';

export interface RouterDecision {
  action: AgentAction;
  reason: string;
  query?: string;
  searchQuery?: string;
}

// ─── Search Types ──────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchConfig {
  enabled: boolean;
  provider: string;
  maxResults: number;
  timeoutMs: number;
}

export interface RetrievedContent {
  url: string;
  title: string;
  content: string;
  snippet: string;
}

// ─── TTS Types ─────────────────────────────────────────────────────

export interface TTSConfig {
  enabled: boolean;
  voice: string;
  speed: number;
}

// ─── Answer Types ──────────────────────────────────────────────────

export interface AnswerSource {
  title: string;
  url: string;
}

export interface Answer {
  text: string;
  sources: AnswerSource[];
  action: AgentAction;
  isStreaming: boolean;
  duration?: number;
}

// ─── Settings Types ────────────────────────────────────────────────

export interface ShortcutConfig {
  toggleListening: string;
  showHide: string;
  clearConversation: string;
  stopListening: string;
}

export interface AppSettings {
  general: {
    startOnLogin: boolean;
    minimizeToTray: boolean;
    theme: 'dark' | 'light';
    overlayOpacity: number;
    compactMode: boolean;
  };
  audio: AudioConfig & {
    vadSensitivity: number;
    silenceTimeoutMs: number;
  };
  stt: STTConfig;
  llm: LLMConfig;
  search: SearchConfig;
  tts: TTSConfig;
  shortcuts: ShortcutConfig;
  privacy: {
    logConversations: boolean;
  };
  context: {
    maxTurns: number;
  };
}

// ─── Diagnostics ───────────────────────────────────────────────────

export interface ComponentStatus {
  name: string;
  status: 'ok' | 'error' | 'unknown' | 'checking';
  message?: string;
  version?: string;
}

export interface SystemDiagnostics {
  ollama: ComponentStatus;
  llmModel: ComponentStatus;
  whisper: ComponentStatus;
  audio: ComponentStatus;
  systemAudio: ComponentStatus;
  microphone: ComponentStatus;
  internet: ComponentStatus;
}

// ─── Performance Metrics ───────────────────────────────────────────

export interface PerformanceMetrics {
  audioLatencyMs?: number;
  vadLatencyMs?: number;
  sttLatencyMs?: number;
  llmLatencyMs?: number;
  searchLatencyMs?: number;
  totalLatencyMs?: number;
  sampleRate?: number;
  vadState?: string;
}
