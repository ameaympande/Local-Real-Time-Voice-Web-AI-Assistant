import React from 'react';

interface StatusBarProps {
  listening: boolean;
  processing: boolean;
  vadActive: boolean;
  connected: boolean;
  message?: string;
  onToggleListening: () => void;
  onShowSettings: () => void;
  onShowDebug: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  listening,
  processing,
  vadActive,
  connected,
  onToggleListening,
  onShowSettings,
  onShowDebug,
}) => {
  const getStatusClass = () => {
    if (!connected) return 'status-indicator--error';
    if (processing) return 'status-indicator--processing';
    if (listening) return 'status-indicator--listening';
    return 'status-indicator--paused';
  };

  const getDotClass = () => {
    if (!connected) return 'status-dot--error';
    if (processing) return 'status-dot--processing';
    if (listening) return 'status-dot--active';
    return 'status-dot--paused';
  };

  const getStatusText = () => {
    if (!connected) return 'Disconnected';
    if (processing) return 'Processing...';
    if (vadActive) return 'Speech detected';
    if (listening) return 'Listening';
    return 'Paused';
  };

  return (
    <>
      <div className="title-bar">
        <div className="title-bar__left">
          <span className="title-bar__title">LocalVoiceAgent</span>
        </div>
        <div className="title-bar__right">
          <div className={`status-indicator ${getStatusClass()}`}>
            <span className={`status-dot ${getDotClass()}`} />
            <span>{getStatusText()}</span>
          </div>
        </div>
      </div>

      <div className="bottom-bar">
        <div className="bottom-bar__left">
          <button
            className={`btn btn--listen ${listening ? 'active' : ''}`}
            onClick={onToggleListening}
            title={listening ? 'Stop listening (⌘⇧Space)' : 'Start listening (⌘⇧Space)'}
            id="btn-toggle-listen"
          >
            {listening ? '🎙' : '🎤'}
          </button>
        </div>
        <div className="bottom-bar__right">
          <button
            className="btn btn--icon"
            onClick={onShowDebug}
            title="Debug panel"
            id="btn-debug"
          >
            📊
          </button>
          <button
            className="btn btn--icon"
            onClick={onShowSettings}
            title="Settings"
            id="btn-settings"
          >
            ⚙️
          </button>
        </div>
      </div>
    </>
  );
};
