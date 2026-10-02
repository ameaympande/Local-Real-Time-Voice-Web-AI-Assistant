// ─── WebSocket Event Types ─────────────────────────────────────────
// All events sent between backend and desktop over WebSocket

// ─── Client → Server Events ────────────────────────────────────────

export interface AudioDataEvent {
  type: 'audio.data';
  data: string; // base64 encoded audio
  sampleRate: number;
  channels: number;
}

export interface ControlEvent {
  type: 'control.start' | 'control.stop' | 'control.clear' | 'control.pause' | 'control.resume';
}

export interface SettingsUpdateEvent {
  type: 'settings.update';
  settings: Record<string, unknown>;
}

export interface DiagnosticsRequestEvent {
  type: 'diagnostics.request';
}

// ─── Server → Client Events ────────────────────────────────────────

export interface TranscriptPartialEvent {
  type: 'transcript.partial';
  text: string;
  timestamp: number;
}

export interface TranscriptFinalEvent {
  type: 'transcript.final';
  text: string;
  timestamp: number;
  confidence?: number;
}

export interface AnswerDeltaEvent {
  type: 'answer.delta';
  text: string;
}

export interface AnswerCompleteEvent {
  type: 'answer.complete';
  text: string;
  sources: Array<{ title: string; url: string }>;
  action: string;
  duration: number;
}

export interface AnswerStartEvent {
  type: 'answer.start';
  action: string;
  reason: string;
}

export interface StatusEvent {
  type: 'status.update';
  listening: boolean;
  processing: boolean;
  vadActive: boolean;
  message?: string;
}

export interface ErrorEvent {
  type: 'error';
  code: string;
  message: string;
  details?: string;
}

export interface MetricsEvent {
  type: 'metrics.update';
  sttLatencyMs?: number;
  llmLatencyMs?: number;
  searchLatencyMs?: number;
  totalLatencyMs?: number;
  sampleRate?: number;
  vadState?: string;
}

export interface DiagnosticsResponseEvent {
  type: 'diagnostics.response';
  diagnostics: Record<string, { status: string; message?: string }>;
}

export interface SearchProgressEvent {
  type: 'search.progress';
  stage: 'searching' | 'reading' | 'analyzing';
  message: string;
}

// ─── Union Types ───────────────────────────────────────────────────

export type ClientEvent =
  | AudioDataEvent
  | ControlEvent
  | SettingsUpdateEvent
  | DiagnosticsRequestEvent;

export type ServerEvent =
  | TranscriptPartialEvent
  | TranscriptFinalEvent
  | AnswerDeltaEvent
  | AnswerCompleteEvent
  | AnswerStartEvent
  | StatusEvent
  | ErrorEvent
  | MetricsEvent
  | DiagnosticsResponseEvent
  | SearchProgressEvent;

export type WSEvent = ClientEvent | ServerEvent;
