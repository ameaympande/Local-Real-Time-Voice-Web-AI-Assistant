import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, access, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir, homedir } from 'os';
import type { STTProvider, Transcript, STTModelSize } from '@local-voice-agent/shared';
import { createLogger } from '../logger.js';

const log = createLogger('whisper');
const execFileAsync = promisify(execFile);

const MODEL_URLS: Record<STTModelSize, string> = {
  tiny: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
  base: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
  small: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
};

const MODEL_FILES: Record<STTModelSize, string> = {
  tiny: 'ggml-tiny.en.bin',
  base: 'ggml-base.en.bin',
  small: 'ggml-small.en.bin',
};

/**
 * WhisperCpp STT Provider
 * 
 * Uses the whisper.cpp binary to transcribe audio chunks.
 * Optimized for Apple Silicon with Metal acceleration.
 */
export class WhisperCppProvider implements STTProvider {
  private binaryPath: string;
  private modelsDir: string;
  private modelSize: STTModelSize;
  private language: string;
  private ready = false;
  private tempDir: string;

  constructor(
    binaryPath: string = '',
    modelsDir: string = '',
    modelSize: STTModelSize = 'tiny',
    language: string = 'en',
  ) {
    // Try common whisper.cpp locations
    this.binaryPath = binaryPath || this.findWhisperBinary();
    this.modelsDir = modelsDir || join(homedir(), '.local', 'share', 'whisper-models');
    this.modelSize = modelSize;
    this.language = language;
    this.tempDir = join(tmpdir(), 'local-voice-agent');
  }

  private findWhisperBinary(): string {
    // Common locations for whisper.cpp binary
    const candidates = [
      '/opt/homebrew/bin/whisper-cli',
      '/opt/homebrew/bin/whisper-cpp',
      '/opt/homebrew/bin/whisper',
      '/usr/local/bin/whisper-cli',
      '/usr/local/bin/whisper-cpp',
      join(homedir(), '.local', 'bin', 'whisper-cpp'),
      join(homedir(), 'whisper.cpp', 'main'),
      join(homedir(), 'whisper.cpp', 'build', 'bin', 'main'),
    ];
    
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    
    return candidates[0]; // fallback
  }

  async initialize(): Promise<void> {
    // Create temp directory
    try {
      await mkdir(this.tempDir, { recursive: true });
    } catch { /* exists */ }

    // Create models directory
    try {
      await mkdir(this.modelsDir, { recursive: true });
    } catch { /* exists */ }

    // Check binary exists
    try {
      await access(this.binaryPath);
      log.info(`Whisper binary found at ${this.binaryPath}`);
    } catch {
      log.warn(`Whisper binary not found at ${this.binaryPath}`);
      log.info('Install whisper.cpp: brew install whisper-cpp');
      log.info('Or build from source: https://github.com/ggerganov/whisper.cpp');
      // Don't throw - allow the app to start and show setup instructions
    }

    // Check model exists
    const modelPath = this.getModelPath();
    try {
      await access(modelPath);
      log.info(`Model found: ${modelPath}`);
      this.ready = true;
    } catch {
      log.warn(`Model not found: ${modelPath}`);
      log.info(`Download with: curl -L -o "${modelPath}" "${MODEL_URLS[this.modelSize]}"`);
    }
  }

  private getModelPath(): string {
    return join(this.modelsDir, MODEL_FILES[this.modelSize]);
  }

  async transcribe(audioBuffer: Buffer, sampleRate: number): Promise<Transcript> {
    if (!this.ready) {
      return { text: '', isFinal: false, timestamp: Date.now() };
    }

    const startTime = Date.now();
    const wavPath = join(this.tempDir, `chunk_${Date.now()}.wav`);

    try {
      // Write audio buffer as WAV file
      const wavBuffer = this.createWavBuffer(audioBuffer, sampleRate);
      await writeFile(wavPath, wavBuffer);

      // Run whisper.cpp
      const { stdout } = await execFileAsync(this.binaryPath, [
        '-m', this.getModelPath(),
        '-f', wavPath,
        '-l', this.language,
        '-np',              // no prints
        '-nt',              // no timestamps
        '-t', '4',          // threads (good for M2)
      ], {
        timeout: 30000,
      });

      let text = stdout.trim()
        .replace(/\[.*?\]/g, '')  // Remove timestamp brackets
        .replace(/\(.*?\)/g, '')  // Remove sound effects like (keyboard clicking)
        .replace(/\*.*?\*/g, '')  // Remove sound effects like *typing*
        .replace(/^[.,?!:;\s]+$/g, '') // Remove if it's just punctuation
        .replace(/\s+/g, ' ')    // Normalize whitespace
        .trim();

      const elapsed = Date.now() - startTime;
      log.debug(`Transcribed in ${elapsed}ms: "${text.substring(0, 80)}..."`);

      return {
        text,
        isFinal: true,
        confidence: undefined,
        timestamp: Date.now(),
        duration: elapsed,
      };
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === 'ENOENT') {
        log.error('Whisper binary not found. Install whisper.cpp first.');
      } else {
        log.error('Transcription failed', { error: err.message });
      }
      return { text: '', isFinal: false, timestamp: Date.now() };
    } finally {
      // Clean up temp file
      try {
        await unlink(wavPath);
      } catch { /* ok if already deleted */ }
    }
  }

  /**
   * Creates a 16-bit PCM WAV file buffer from raw audio data.
   */
  private createWavBuffer(audioData: Buffer, sampleRate: number): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);

    // If audioData is Float32, convert to Int16
    let pcmData: Buffer;
    if (audioData.length % 4 === 0) {
      // Assume float32
      const float32 = new Float32Array(audioData.buffer, audioData.byteOffset, audioData.length / 4);
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      pcmData = Buffer.from(int16.buffer);
    } else {
      // Assume already int16
      pcmData = audioData;
    }

    const dataSize = pcmData.length;
    const header = Buffer.alloc(44);

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);

    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);        // chunk size
    header.writeUInt16LE(1, 20);         // PCM
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmData]);
  }

  isReady(): boolean {
    return this.ready;
  }

  getModelInfo(): { name: string; size: string } {
    return {
      name: `whisper-${this.modelSize}`,
      size: this.modelSize,
    };
  }

  getInstallInstructions(): string {
    return [
      '=== Whisper.cpp Setup ===',
      '',
      '1. Install whisper.cpp:',
      '   brew install whisper-cpp',
      '',
      '   Or build from source:',
      '   git clone https://github.com/ggerganov/whisper.cpp.git',
      '   cd whisper.cpp && make -j',
      '',
      '2. Download model:',
      `   mkdir -p "${this.modelsDir}"`,
      `   curl -L -o "${this.getModelPath()}" "${MODEL_URLS[this.modelSize]}"`,
      '',
      '3. Set binary path in .env if not in standard location:',
      '   WHISPER_BINARY_PATH=/path/to/whisper-cpp',
      '',
    ].join('\n');
  }

  async dispose(): Promise<void> {
    this.ready = false;
  }
}
