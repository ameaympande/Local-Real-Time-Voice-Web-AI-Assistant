import { execFile, ChildProcess } from 'child_process';
import type { TTSProvider } from '@local-voice-agent/shared';
import { createLogger } from '../logger.js';

const log = createLogger('tts');

/**
 * macOS TTS provider using the built-in `say` command.
 * Zero external dependencies.
 */
export class MacOSTTSProvider implements TTSProvider {
  private voice: string;
  private speed: number;
  private currentProcess: ChildProcess | null = null;

  constructor(voice = 'Samantha', speed = 175) {
    this.voice = voice;
    this.speed = speed;
  }

  async speak(text: string): Promise<void> {
    // Stop any current speech
    await this.stop();

    return new Promise<void>((resolve, reject) => {
      this.currentProcess = execFile('say', [
        '-v', this.voice,
        '-r', String(this.speed),
        text,
      ], (error) => {
        this.currentProcess = null;
        if (error) {
          // Don't error on kill (SIGTERM)
          if ((error as NodeJS.ErrnoException).signal !== 'SIGTERM') {
            log.error('TTS failed', { error: error.message });
            reject(error);
            return;
          }
        }
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
  }

  isSpeaking(): boolean {
    return this.currentProcess !== null;
  }

  async getVoices(): Promise<string[]> {
    return new Promise((resolve) => {
      execFile('say', ['-v', '?'], (error, stdout) => {
        if (error) {
          resolve(['Samantha', 'Alex', 'Daniel', 'Karen', 'Moira', 'Tessa']);
          return;
        }
        const voices = stdout
          .split('\n')
          .map(line => line.split(/\s{2,}/)[0]?.trim())
          .filter(Boolean) as string[];
        resolve(voices.length > 0 ? voices : ['Samantha']);
      });
    });
  }

  setVoice(voice: string): void {
    this.voice = voice;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }
}
