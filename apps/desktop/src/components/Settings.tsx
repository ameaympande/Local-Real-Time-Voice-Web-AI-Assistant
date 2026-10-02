import React, { useState } from 'react';

interface SettingsProps {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: Record<string, unknown>) => void;
  initialSettings: {
    audioSource: string;
    sttModel: string;
    llmModel: string;
    ollamaUrl: string;
    temperature: number;
    maxTokens: number;
    searchEnabled: boolean;
    ttsEnabled: boolean;
    ttsVoice: string;
    ttsSpeed: number;
    vadSensitivity: number;
    silenceTimeout: number;
    maxTurns: number;
    overlayOpacity: number;
  };
}

export const Settings: React.FC<SettingsProps> = ({ visible, onClose, onSave, initialSettings }) => {
  const [settings, setSettings] = useState(initialSettings);

  if (!visible) return null;

  const update = (key: string, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave({
      audio: {
        source: settings.audioSource,
        vadSensitivity: settings.vadSensitivity,
        silenceTimeoutMs: settings.silenceTimeout,
      },
      stt: { model: settings.sttModel },
      llm: {
        url: settings.ollamaUrl,
        model: settings.llmModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      },
      search: { enabled: settings.searchEnabled },
      tts: {
        enabled: settings.ttsEnabled,
        voice: settings.ttsVoice,
        speed: settings.ttsSpeed,
      },
      context: { maxTurns: settings.maxTurns },
      general: { overlayOpacity: settings.overlayOpacity },
    });
    onClose();
  };

  return (
    <div className="settings-overlay">
      <div className="settings-header">
        <h2 className="settings-header__title">Settings</h2>
        <button className="btn btn--ghost" onClick={onClose} id="btn-close-settings">
          ✕ Close
        </button>
      </div>

      <div className="settings-content">
        {/* Audio */}
        <div className="settings-section">
          <h3 className="settings-section__title">Audio</h3>
          <div className="settings-row">
            <span className="settings-row__label">Audio Source</span>
            <select
              className="select"
              value={settings.audioSource}
              onChange={e => update('audioSource', e.target.value)}
              id="select-audio-source"
            >
              <option value="microphone">Microphone</option>
              <option value="system">System Audio</option>
            </select>
          </div>
          <div className="settings-row">
            <span className="settings-row__label">VAD Sensitivity</span>
            <input
              type="range"
              className="slider"
              min="0"
              max="1"
              step="0.05"
              value={settings.vadSensitivity}
              onChange={e => update('vadSensitivity', parseFloat(e.target.value))}
              id="slider-vad-sensitivity"
            />
          </div>
          <div className="settings-row">
            <span className="settings-row__label">Silence Timeout (ms)</span>
            <input
              type="number"
              className="input"
              value={settings.silenceTimeout}
              onChange={e => update('silenceTimeout', parseInt(e.target.value) || 1500)}
              min="300"
              max="5000"
              step="100"
              id="input-silence-timeout"
            />
          </div>
        </div>

        {/* STT */}
        <div className="settings-section">
          <h3 className="settings-section__title">Speech-to-Text</h3>
          <div className="settings-row">
            <span className="settings-row__label">Model</span>
            <select
              className="select"
              value={settings.sttModel}
              onChange={e => update('sttModel', e.target.value)}
              id="select-stt-model"
            >
              <option value="tiny">Tiny (~75MB, fastest)</option>
              <option value="base">Base (~140MB, better)</option>
              <option value="small">Small (~460MB, best)</option>
            </select>
          </div>
        </div>

        {/* LLM */}
        <div className="settings-section">
          <h3 className="settings-section__title">LLM (Ollama)</h3>
          <div className="settings-row">
            <span className="settings-row__label">Ollama URL</span>
            <input
              type="text"
              className="input"
              value={settings.ollamaUrl}
              onChange={e => update('ollamaUrl', e.target.value)}
              style={{ width: '180px' }}
              id="input-ollama-url"
            />
          </div>
          <div className="settings-row">
            <span className="settings-row__label">Model</span>
            <input
              type="text"
              className="input"
              value={settings.llmModel}
              onChange={e => update('llmModel', e.target.value)}
              placeholder="qwen2.5:0.5b"
              id="input-llm-model"
            />
          </div>
          <div className="settings-row">
            <span className="settings-row__label">Temperature</span>
            <input
              type="range"
              className="slider"
              min="0"
              max="1"
              step="0.1"
              value={settings.temperature}
              onChange={e => update('temperature', parseFloat(e.target.value))}
              id="slider-temperature"
            />
          </div>
          <div className="settings-row">
            <span className="settings-row__label">Max Tokens</span>
            <input
              type="number"
              className="input"
              value={settings.maxTokens}
              onChange={e => update('maxTokens', parseInt(e.target.value) || 256)}
              min="64"
              max="2048"
              step="64"
              id="input-max-tokens"
            />
          </div>
        </div>

        {/* Web Search */}
        <div className="settings-section">
          <h3 className="settings-section__title">Web Search</h3>
          <div className="settings-row">
            <span className="settings-row__label">Enable Web Search</span>
            <button
              className={`toggle ${settings.searchEnabled ? 'active' : ''}`}
              onClick={() => update('searchEnabled', !settings.searchEnabled)}
              id="toggle-search"
            />
          </div>
        </div>

        {/* TTS */}
        <div className="settings-section">
          <h3 className="settings-section__title">Text-to-Speech</h3>
          <div className="settings-row">
            <span className="settings-row__label">Enable Voice</span>
            <button
              className={`toggle ${settings.ttsEnabled ? 'active' : ''}`}
              onClick={() => update('ttsEnabled', !settings.ttsEnabled)}
              id="toggle-tts"
            />
          </div>
          <div className="settings-row">
            <span className="settings-row__label">Voice</span>
            <select
              className="select"
              value={settings.ttsVoice}
              onChange={e => update('ttsVoice', e.target.value)}
              id="select-tts-voice"
            >
              <option value="Samantha">Samantha</option>
              <option value="Alex">Alex</option>
              <option value="Daniel">Daniel</option>
              <option value="Karen">Karen</option>
            </select>
          </div>
          <div className="settings-row">
            <span className="settings-row__label">Speed</span>
            <input
              type="range"
              className="slider"
              min="100"
              max="300"
              step="25"
              value={settings.ttsSpeed}
              onChange={e => update('ttsSpeed', parseInt(e.target.value))}
              id="slider-tts-speed"
            />
          </div>
        </div>

        {/* Context */}
        <div className="settings-section">
          <h3 className="settings-section__title">Conversation</h3>
          <div className="settings-row">
            <span className="settings-row__label">Memory (turns)</span>
            <select
              className="select"
              value={settings.maxTurns}
              onChange={e => update('maxTurns', parseInt(e.target.value))}
              id="select-max-turns"
            >
              <option value="0">Off</option>
              <option value="10">10 turns</option>
              <option value="20">20 turns</option>
              <option value="50">50 turns</option>
            </select>
          </div>
        </div>

        {/* Privacy */}
        <div className="settings-section">
          <h3 className="settings-section__title">Privacy</h3>
          <div className="settings-row">
            <span className="settings-row__label">All processing is local</span>
            <span className="settings-row__value" style={{ color: 'var(--accent-success)' }}>✓</span>
          </div>
          <div className="settings-row">
            <span className="settings-row__label">Audio never uploaded</span>
            <span className="settings-row__value" style={{ color: 'var(--accent-success)' }}>✓</span>
          </div>
          <div className="settings-row">
            <span className="settings-row__label">Only search queries go online</span>
            <span className="settings-row__value" style={{ color: 'var(--accent-info)' }}>ℹ</span>
          </div>
        </div>

        {/* Shortcuts */}
        <div className="settings-section">
          <h3 className="settings-section__title">Keyboard Shortcuts</h3>
          <div className="settings-row">
            <span className="settings-row__label">Toggle Listening</span>
            <span className="settings-row__value">⌘⇧Space</span>
          </div>
          <div className="settings-row">
            <span className="settings-row__label">Show/Hide</span>
            <span className="settings-row__value">⌘⇧A</span>
          </div>
          <div className="settings-row">
            <span className="settings-row__label">Clear Conversation</span>
            <span className="settings-row__value">⌘⇧C</span>
          </div>
          <div className="settings-row">
            <span className="settings-row__label">Stop Listening</span>
            <span className="settings-row__value">⌘⇧S</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '16px' }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} id="btn-save-settings">Save</button>
        </div>
      </div>
    </div>
  );
};
