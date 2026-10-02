import React, { useState, useEffect } from 'react';

interface DiagnosticsData {
  [key: string]: { status: string; message?: string };
}

interface FirstRunProps {
  onComplete: () => void;
  onRequestDiagnostics: () => void;
  diagnostics: DiagnosticsData | null;
}

export const FirstRun: React.FC<FirstRunProps> = ({
  onComplete,
  onRequestDiagnostics,
  diagnostics,
}) => {
  const [hasRunDiagnostics, setHasRunDiagnostics] = useState(false);

  useEffect(() => {
    // Auto-run diagnostics on mount
    const timer = setTimeout(() => {
      onRequestDiagnostics();
      setHasRunDiagnostics(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [onRequestDiagnostics]);

  const features = [
    'Local speech recognition',
    'Local LLM (Ollama)',
    'Optional web search',
    'No paid AI API required',
    'Privacy-first design',
  ];

  const diagnosticItems = [
    { key: 'ollama', label: 'Ollama' },
    { key: 'llmModel', label: 'LLM Model' },
    { key: 'whisper', label: 'Whisper STT' },
    { key: 'audio', label: 'Audio' },
    { key: 'systemAudio', label: 'System Audio' },
    { key: 'microphone', label: 'Microphone' },
    { key: 'internet', label: 'Internet' },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return '✓';
      case 'error': return '✗';
      case 'unknown': return '?';
      case 'checking': return '…';
      default: return '?';
    }
  };

  const getStatusClass = (status: string) => {
    return `diagnostic-item__status diagnostic-item__status--${status}`;
  };

  return (
    <div className="first-run">
      <div className="first-run__logo">🎙</div>
      <h1 className="first-run__title">LocalVoiceAgent</h1>
      <p className="first-run__subtitle">
        Your assistant runs entirely on your machine.
      </p>

      <ul className="first-run__features">
        {features.map((feature, i) => (
          <li key={i} className="first-run__feature">
            <span className="first-run__feature-check">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {hasRunDiagnostics && (
        <div className="diagnostics">
          {diagnosticItems.map(({ key, label }) => {
            const diag = diagnostics?.[key];
            const status = diag?.status || 'checking';
            return (
              <div key={key} className="diagnostic-item">
                <span className="diagnostic-item__name">{label}</span>
                <span className={getStatusClass(status)}>
                  {getStatusIcon(status)} {status === 'error' ? diag?.message?.split('.')[0] : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button
        className="btn btn--primary"
        onClick={onComplete}
        style={{ marginTop: '24px' }}
        id="btn-get-started"
      >
        Get Started
      </button>
    </div>
  );
};
