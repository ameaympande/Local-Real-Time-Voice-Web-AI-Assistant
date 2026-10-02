import { createLogger } from '../logger.js';

const log = createLogger('vad');

export interface VADOptions {
  /** Sensitivity: 0.0 (ignore everything) to 1.0 (trigger on anything). Default 0.5 */
  sensitivity: number;
  /** Silence duration (ms) before speech is considered ended. Default 1500 */
  silenceTimeoutMs: number;
  /** Minimum speech duration (ms) to consider valid. Default 300 */
  minSpeechDurationMs: number;
}

export type VADState = 'idle' | 'speech' | 'silence';

/**
 * Energy-based Voice Activity Detection.
 * 
 * Lightweight, runs in the Node.js process.
 * Uses RMS energy threshold to detect speech.
 */
export class EnergyVAD {
  private sensitivity: number;
  private silenceTimeoutMs: number;
  private minSpeechDurationMs: number;

  private state: VADState = 'idle';
  private speechStartTime = 0;
  private lastSpeechTime = 0;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  // Adaptive threshold
  private noiseFloor = 0.01;
  private noiseFloorAlpha = 0.995; // Slow adaptation

  // Callbacks
  private onSpeechStart?: () => void;
  private onSpeechEnd?: (duration: number) => void;

  constructor(options: Partial<VADOptions> = {}) {
    this.sensitivity = options.sensitivity ?? 0.5;
    this.silenceTimeoutMs = options.silenceTimeoutMs ?? 1500;
    this.minSpeechDurationMs = options.minSpeechDurationMs ?? 300;
  }

  /**
   * Process an audio chunk and detect speech activity.
   * @param audioData - Raw PCM audio data (Float32 or Int16)
   * @returns true if speech is detected in this chunk
   */
  processChunk(audioData: Buffer): boolean {
    const rms = this.calculateRMS(audioData);

    // Adapt noise floor during silence
    if (this.state === 'idle') {
      this.noiseFloor = this.noiseFloorAlpha * this.noiseFloor + (1 - this.noiseFloorAlpha) * rms;
    }

    // Threshold based on sensitivity and noise floor
    // Higher sensitivity = lower threshold = easier to trigger
    const threshold = this.noiseFloor * (3.0 - this.sensitivity * 2.5);

    const isSpeech = rms > threshold;

    if (isSpeech) {
      this.handleSpeechDetected();
    } else {
      this.handleSilenceDetected();
    }

    return isSpeech;
  }

  private handleSpeechDetected(): void {
    this.lastSpeechTime = Date.now();

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.state !== 'speech') {
      this.state = 'speech';
      this.speechStartTime = Date.now();
      log.debug('Speech started');
      this.onSpeechStart?.();
    }
  }

  private handleSilenceDetected(): void {
    if (this.state === 'speech' && !this.silenceTimer) {
      this.silenceTimer = setTimeout(() => {
        const duration = Date.now() - this.speechStartTime;
        if (duration >= this.minSpeechDurationMs) {
          log.debug(`Speech ended, duration: ${duration}ms`);
          this.onSpeechEnd?.(duration);
        } else {
          log.debug(`Speech too short (${duration}ms), ignoring`);
        }
        this.state = 'idle';
        this.silenceTimer = null;
      }, this.silenceTimeoutMs);
    }
  }

  /**
   * Calculate Root Mean Square energy of the audio buffer.
   */
  private calculateRMS(buffer: Buffer): number {
    // Try to interpret as Float32 first
    if (buffer.length >= 4 && buffer.length % 4 === 0) {
      const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
      let sumSquares = 0;
      for (let i = 0; i < samples.length; i++) {
        sumSquares += samples[i] * samples[i];
      }
      return Math.sqrt(sumSquares / samples.length);
    }

    // Fallback: Int16
    if (buffer.length >= 2 && buffer.length % 2 === 0) {
      const samples = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
      let sumSquares = 0;
      for (let i = 0; i < samples.length; i++) {
        const normalized = samples[i] / 32768;
        sumSquares += normalized * normalized;
      }
      return Math.sqrt(sumSquares / samples.length);
    }

    return 0;
  }

  /** Register callback for speech start */
  onSpeechStartCallback(callback: () => void): void {
    this.onSpeechStart = callback;
  }

  /** Register callback for speech end */
  onSpeechEndCallback(callback: (duration: number) => void): void {
    this.onSpeechEnd = callback;
  }

  getState(): VADState {
    return this.state;
  }

  setSensitivity(value: number): void {
    this.sensitivity = Math.max(0, Math.min(1, value));
  }

  setSilenceTimeout(ms: number): void {
    this.silenceTimeoutMs = ms;
  }

  reset(): void {
    this.state = 'idle';
    this.speechStartTime = 0;
    this.lastSpeechTime = 0;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  dispose(): void {
    this.reset();
    this.onSpeechStart = undefined;
    this.onSpeechEnd = undefined;
  }
}
