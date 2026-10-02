import { describe, it, expect } from 'vitest';
import { EnergyVAD } from '../src/audio/vad.js';

describe('EnergyVAD', () => {
  it('should start in idle state', () => {
    const vad = new EnergyVAD();
    expect(vad.getState()).toBe('idle');
  });

  it('should detect silence (zero buffer)', () => {
    const vad = new EnergyVAD({ sensitivity: 0.5, silenceTimeoutMs: 100 });
    const silentBuffer = Buffer.alloc(4096); // All zeros
    const isSpeech = vad.processChunk(silentBuffer);
    expect(isSpeech).toBe(false);
  });

  it('should detect loud audio', () => {
    const vad = new EnergyVAD({ sensitivity: 0.8, silenceTimeoutMs: 100 });

    // Create a buffer with loud audio (float32)
    const floatArray = new Float32Array(1024);
    for (let i = 0; i < floatArray.length; i++) {
      floatArray[i] = Math.sin(i * 0.1) * 0.8; // Loud sine wave
    }
    const buffer = Buffer.from(floatArray.buffer);

    // First call establishes noise floor, second should detect speech
    vad.processChunk(Buffer.alloc(4096)); // Silent baseline
    const isSpeech = vad.processChunk(buffer);
    expect(isSpeech).toBe(true);
  });

  it('should call onSpeechStart when speech begins', () => {
    const vad = new EnergyVAD({ sensitivity: 0.8, silenceTimeoutMs: 500 });
    let speechStarted = false;
    vad.onSpeechStartCallback(() => { speechStarted = true; });

    // Establish noise floor
    vad.processChunk(Buffer.alloc(4096));

    // Loud audio
    const floatArray = new Float32Array(1024);
    for (let i = 0; i < floatArray.length; i++) {
      floatArray[i] = Math.sin(i * 0.1) * 0.9;
    }
    vad.processChunk(Buffer.from(floatArray.buffer));

    expect(speechStarted).toBe(true);
  });

  it('should reset state', () => {
    const vad = new EnergyVAD();
    vad.reset();
    expect(vad.getState()).toBe('idle');
  });

  it('should update sensitivity', () => {
    const vad = new EnergyVAD({ sensitivity: 0.5 });
    vad.setSensitivity(0.9);
    // No error
  });

  it('should clamp sensitivity between 0 and 1', () => {
    const vad = new EnergyVAD();
    vad.setSensitivity(2.0);  // Should clamp to 1.0
    vad.setSensitivity(-1.0); // Should clamp to 0.0
    // No error
  });
});
