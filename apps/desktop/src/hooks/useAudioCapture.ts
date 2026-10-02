import { useRef, useCallback, useState } from 'react';

interface UseAudioCaptureReturn {
  isCapturing: boolean;
  startCapture: (source: 'microphone' | 'system', onChunk: (data: string) => void) => Promise<void>;
  stopCapture: () => void;
  audioLevel: number;
  error: string | null;
}

export function useAudioCapture(): UseAudioCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  const startCapture = useCallback(async (source: 'microphone' | 'system', onChunk: (data: string) => void) => {
    try {
      setError(null);
      let stream: MediaStream;

      if (source === 'system') {
        // Use Electron's desktopCapturer for system audio
        // This requires screen capture permissions on macOS
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              // @ts-expect-error - Electron-specific constraint for system audio
              mandatory: {
                chromeMediaSource: 'desktop',
              },
            },
            video: false,
          });
        } catch {
          // Fallback: try to get system audio via screen capture
          stream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: { width: 1, height: 1 }, // Minimal video
          });

          // Stop the video track since we only need audio
          stream.getVideoTracks().forEach(track => track.stop());
        }
      } else {
        // Microphone
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
            channelCount: 1,
          },
        });
      }

      streamRef.current = stream;

      // Create audio context for processing
      const audioContext = new AudioContext({ sampleRate: 16000 });
      contextRef.current = audioContext;

      const sourceNode = audioContext.createMediaStreamSource(stream);

      // Analyser for audio level visualization
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      sourceNode.connect(analyser);

      // ScriptProcessor for sending audio data
      // Buffer size of 4096 at 16kHz = ~256ms chunks
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);

        // Convert Float32Array to base64 for WebSocket transmission
        const buffer = new ArrayBuffer(inputData.length * 4);
        const view = new Float32Array(buffer);
        view.set(inputData);

        const base64 = arrayBufferToBase64(buffer);
        onChunk(base64);
      };

      sourceNode.connect(processor);
      processor.connect(audioContext.destination);

      // Audio level monitoring
      const updateLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        setAudioLevel(avg / 255);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      setIsCapturing(true);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        setError('Microphone permission denied. Check System Settings > Privacy > Microphone.');
      } else if (message.includes('NotFoundError') || message.includes('DevicesNotFoundError')) {
        setError('No audio device found. Check your audio input configuration.');
      } else {
        setError(`Audio capture failed: ${message}`);
      }
      console.error('Audio capture error:', err);
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    processorRef.current?.disconnect();
    processorRef.current = null;

    analyserRef.current = null;

    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    contextRef.current?.close();
    contextRef.current = null;

    setIsCapturing(false);
    setAudioLevel(0);
  }, []);

  return { isCapturing, startCapture, stopCapture, audioLevel, error };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
