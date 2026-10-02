import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioCapture } from './hooks/useAudioCapture';
import { StatusBar } from './components/StatusBar';
import { Conversation, ChatMessage } from './components/Conversation';
import { DebugPanel } from './components/DebugPanel';
import { Settings } from './components/Settings';
import { FirstRun } from './components/FirstRun';

interface AnswerSource {
  title: string;
  url: string;
}

interface Metrics {
  sttLatencyMs?: number;
  llmLatencyMs?: number;
  searchLatencyMs?: number;
  totalLatencyMs?: number;
  sampleRate?: number;
  vadState?: string;
}

// Declare electron API on window
declare global {
  interface Window {
    electronAPI?: {
      onToggleListening: (callback: (listening: boolean) => void) => void;
      onClearContext: (callback: () => void) => void;
      onShowSettings: (callback: () => void) => void;
    };
  }
}

const WS_URL = 'ws://localhost:3399';

export default function App() {
  // ─── State ───────────────────────────────────────────────────────
  const [showFirstRun, setShowFirstRun] = useState(() => {
    return !localStorage.getItem('lva-setup-complete');
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [vadActive, setVadActive] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partialText, setPartialText] = useState('');
  const [currentAssistantId, setCurrentAssistantId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics>({});
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<Record<string, { status: string; message?: string }> | null>(null);

  // ─── Hooks ───────────────────────────────────────────────────────
  const ws = useWebSocket(WS_URL);
  const audio = useAudioCapture();

  // ─── WebSocket Event Handlers ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyEvent = Record<string, any>;

  useEffect(() => {
    const unsubs = [
      ws.subscribe('status.update', (event) => {
        const e = event as AnyEvent;
        setProcessing(!!e.processing);
        setVadActive(!!e.vadActive);
      }),

      ws.subscribe('transcript.partial', (event) => {
        const e = event as AnyEvent;
        setPartialText(String(e.text || ''));
      }),

      ws.subscribe('transcript.final', (event) => {
        const e = event as AnyEvent;
        setPartialText('');
        setMessages(prev => {
          // Prevent duplicates by checking if the last message is identical
          if (prev.length > 0 && prev[prev.length - 1].text === String(e.text || '')) {
            return prev;
          }
          return [...prev, {
            id: `user-${Date.now()}`,
            role: 'user',
            text: String(e.text || ''),
          }];
        });
      }),

      ws.subscribe('answer.start', (event) => {
        const e = event as AnyEvent;
        const newId = `assistant-${Date.now()}`;
        setCurrentAssistantId(newId);
        setMessages(prev => [...prev, {
          id: newId,
          role: 'assistant',
          text: '',
          isStreaming: true,
          action: String(e.action || ''),
        }]);
      }),

      ws.subscribe('answer.delta', (event) => {
        const e = event as AnyEvent;
        setMessages(prev => prev.map(msg => {
          if (msg.role === 'assistant' && msg.isStreaming) {
            return { ...msg, text: msg.text + String(e.text || '') };
          }
          return msg;
        }));
      }),

      ws.subscribe('answer.complete', (event) => {
        const e = event as AnyEvent;
        setCurrentAssistantId(null);
        setMessages(prev => prev.map(msg => {
          if (msg.role === 'assistant' && msg.isStreaming) {
            return { 
              ...msg, 
              text: String(e.text || msg.text),
              isStreaming: false,
              sources: Array.isArray(e.sources) ? e.sources : undefined,
            };
          }
          return msg;
        }));
      }),

      ws.subscribe('search.progress', (event) => {
        const e = event as AnyEvent;
        setMessages(prev => prev.map(msg => {
          if (msg.role === 'assistant' && msg.isStreaming) {
            return { ...msg, searchProgress: String(e.message || '') };
          }
          return msg;
        }));
      }),

      ws.subscribe('metrics.update', (event) => {
        const e = event as AnyEvent;
        setMetrics({
          sttLatencyMs: e.sttLatencyMs,
          llmLatencyMs: e.llmLatencyMs,
          searchLatencyMs: e.searchLatencyMs,
          totalLatencyMs: e.totalLatencyMs,
          sampleRate: e.sampleRate,
          vadState: e.vadState,
        });
      }),

      ws.subscribe('error', (event) => {
        const e = event as AnyEvent;
        setError(String(e.message || 'Unknown error'));
        setTimeout(() => setError(null), 8000);
      }),

      ws.subscribe('diagnostics.response', (event) => {
        const e = event as AnyEvent;
        setDiagnostics(e.diagnostics || null);
      }),
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, [ws]);

  // ─── Audio → WebSocket Pipeline ─────────────────────────────────
  const sendAudioChunk = useCallback((data: string) => {
    ws.send({
      type: 'audio.data',
      data,
      sampleRate: 16000,
      channels: 1,
    });
  }, [ws]);

  // ─── Listening Toggle ───────────────────────────────────────────
  const toggleListening = useCallback(async () => {
    if (listening) {
      // Stop
      audio.stopCapture();
      ws.send({ type: 'control.stop' });
      setListening(false);
    } else {
      // Start
      try {
        await audio.startCapture('microphone', sendAudioChunk);
        ws.send({ type: 'control.start' });
        setListening(true);
      } catch (err) {
        setError(`Failed to start audio: ${(err as Error).message}`);
      }
    }
  }, [listening, audio, ws, sendAudioChunk]);

  // ─── Electron IPC ───────────────────────────────────────────────
  // Use a ref to access latest state without re-triggering useEffect
  const stateRef = useRef({ audio, ws, sendAudioChunk, listening });
  useEffect(() => {
    stateRef.current = { audio, ws, sendAudioChunk, listening };
  }, [audio, ws, sendAudioChunk, listening]);

  useEffect(() => {
    let unmounted = false;
    if (window.electronAPI) {
      window.electronAPI.onToggleListening((state: boolean) => {
        if (unmounted) return;
        const current = stateRef.current;
        if (state && !current.listening) {
          current.audio.startCapture('microphone', current.sendAudioChunk).then(() => {
            current.ws.send({ type: 'control.start' });
            setListening(true);
          });
        } else if (!state && current.listening) {
          current.audio.stopCapture();
          current.ws.send({ type: 'control.stop' });
          setListening(false);
        }
      });

      window.electronAPI.onClearContext(() => {
        if (unmounted) return;
        stateRef.current.ws.send({ type: 'control.clear' });
        setMessages([]);
        setPartialText('');
      });

      window.electronAPI.onShowSettings(() => {
        if (!unmounted) setShowSettings(true);
      });
    }
    return () => { unmounted = true; };
  }, []); // Run exactly once

  // ─── First Run Complete ─────────────────────────────────────────
  const handleFirstRunComplete = useCallback(() => {
    localStorage.setItem('lva-setup-complete', 'true');
    setShowFirstRun(false);
  }, []);

  const requestDiagnostics = useCallback(() => {
    ws.send({ type: 'diagnostics.request' });
  }, [ws]);

  // ─── Clear Conversation ─────────────────────────────────────────
  const clearConversation = useCallback(() => {
    ws.send({ type: 'control.clear' });
    setMessages([]);
    setPartialText('');
  }, [ws]);

  // ─── Settings ────────────────────────────────────────────────────
  const handleSaveSettings = useCallback((settings: Record<string, unknown>) => {
    ws.send({ type: 'settings.update', settings });
  }, [ws]);

  // ─── Render ──────────────────────────────────────────────────────

  if (showFirstRun) {
    return (
      <div className="app-container">
        <FirstRun
          onComplete={handleFirstRunComplete}
          onRequestDiagnostics={requestDiagnostics}
          diagnostics={diagnostics}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      <StatusBar
        listening={listening}
        processing={processing}
        vadActive={vadActive}
        connected={ws.connected}
        onToggleListening={toggleListening}
        onShowSettings={() => setShowSettings(true)}
        onShowDebug={() => setShowDebug(prev => !prev)}
      />

      <div className="main-content">
        {error && (
          <div className="error-banner">
            <span className="error-banner__icon">⚠️</span>
            <span>{error}</span>
            <button className="error-banner__dismiss" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {audio.error && (
          <div className="error-banner">
            <span className="error-banner__icon">🎤</span>
            <span>{audio.error}</span>
          </div>
        )}

        <Conversation messages={messages} partialText={partialText} />

        <DebugPanel
          metrics={metrics}
          audioLevel={audio.audioLevel}
          connected={ws.connected}
          visible={showDebug}
        />
      </div>

      {/* Bottom bar is part of StatusBar */}
      <div className="bottom-bar">
        <div className="bottom-bar__left">
          <button
            className={`btn btn--listen ${listening ? 'active' : ''}`}
            onClick={toggleListening}
            title={listening ? 'Stop listening (⌘⇧Space)' : 'Start listening (⌘⇧Space)'}
            id="btn-toggle-listen-bottom"
          >
            {listening ? '🎙' : '🎤'}
          </button>
          <button
            className="btn btn--ghost"
            onClick={clearConversation}
            title="Clear conversation (⌘⇧C)"
            id="btn-clear"
          >
            🗑 Clear
          </button>
        </div>
        <div className="bottom-bar__right">
          <button
            className="btn btn--icon"
            onClick={() => setShowDebug(prev => !prev)}
            title="Debug panel"
            id="btn-debug-bottom"
          >
            📊
          </button>
          <button
            className="btn btn--icon"
            onClick={() => setShowSettings(true)}
            title="Settings"
            id="btn-settings-bottom"
          >
            ⚙️
          </button>
        </div>
      </div>

      <Settings
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveSettings}
        initialSettings={{
          audioSource: 'microphone',
          sttModel: 'base',
          llmModel: 'qwen2.5:3b',
          ollamaUrl: 'http://localhost:11434',
          temperature: 0.3,
          maxTokens: 256,
          searchEnabled: true,
          ttsEnabled: false,
          ttsVoice: 'Samantha',
          ttsSpeed: 175,
          vadSensitivity: 0.4,
          silenceTimeout: 400,
          maxTurns: 20,
          overlayOpacity: 0.95,
        }}
      />
    </div>
  );
}
