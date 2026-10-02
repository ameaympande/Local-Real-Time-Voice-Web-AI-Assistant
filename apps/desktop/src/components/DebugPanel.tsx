import React from 'react';

interface DebugPanelProps {
  metrics: {
    sttLatencyMs?: number;
    llmLatencyMs?: number;
    searchLatencyMs?: number;
    totalLatencyMs?: number;
    sampleRate?: number;
    vadState?: string;
  };
  audioLevel: number;
  connected: boolean;
  visible: boolean;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  metrics,
  audioLevel,
  connected,
  visible,
}) => {
  if (!visible) return null;

  return (
    <div className="debug-panel">
      <div className="debug-panel__item">
        <span className="debug-panel__label">WS</span>
        <span className="debug-panel__value" style={{
          color: connected ? 'var(--accent-success)' : 'var(--accent-error)',
        }}>
          {connected ? '●' : '○'}
        </span>
      </div>
      <div className="debug-panel__item">
        <span className="debug-panel__label">Audio</span>
        <span className="debug-panel__value">
          {(audioLevel * 100).toFixed(0)}%
        </span>
      </div>
      <div className="debug-panel__item">
        <span className="debug-panel__label">VAD</span>
        <span className="debug-panel__value">
          {metrics.vadState || 'idle'}
        </span>
      </div>
      <div className="debug-panel__item">
        <span className="debug-panel__label">STT</span>
        <span className="debug-panel__value">
          {metrics.sttLatencyMs ? `${metrics.sttLatencyMs}ms` : '—'}
        </span>
      </div>
      <div className="debug-panel__item">
        <span className="debug-panel__label">LLM</span>
        <span className="debug-panel__value">
          {metrics.llmLatencyMs ? `${(metrics.llmLatencyMs / 1000).toFixed(1)}s` : '—'}
        </span>
      </div>
      {metrics.searchLatencyMs && (
        <div className="debug-panel__item">
          <span className="debug-panel__label">Search</span>
          <span className="debug-panel__value">
            {`${metrics.searchLatencyMs}ms`}
          </span>
        </div>
      )}
      <div className="debug-panel__item">
        <span className="debug-panel__label">Total</span>
        <span className="debug-panel__value">
          {metrics.totalLatencyMs ? `${(metrics.totalLatencyMs / 1000).toFixed(1)}s` : '—'}
        </span>
      </div>
    </div>
  );
};
