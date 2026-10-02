import React, { useEffect, useRef } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isStreaming?: boolean;
  sources?: { title: string; url: string }[];
  action?: string;
  searchProgress?: string;
}

interface ConversationProps {
  messages: ChatMessage[];
  partialText: string;
}

export const Conversation: React.FC<ConversationProps> = ({ messages, partialText }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, partialText]);

  return (
    <div className="conversation-panel" ref={scrollRef}>
      {messages.length === 0 && !partialText && (
        <div className="conversation-panel__empty">
          <div className="empty-icon">🎙️</div>
          <div className="empty-text">Start speaking...</div>
        </div>
      )}

      {messages.map((msg) => (
        <div key={msg.id} className={`message message--${msg.role}`}>
          <div className="message__header">
            {msg.role === 'user' ? 'You' : 'Assistant'}
            {msg.action === 'web_search' && <span className="message__badge">🌐 Web</span>}
          </div>
          <div className="message__content">{msg.text}</div>
          
          {msg.searchProgress && (
            <div className="message__search-progress">
              <span className="spinner" /> {msg.searchProgress}
            </div>
          )}

          {msg.sources && msg.sources.length > 0 && (
            <div className="message__sources">
              <div className="message__sources-label">Sources:</div>
              {msg.sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noreferrer" className="source-link">
                  {s.title}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}

      {partialText && (
        <div className="message message--user message--partial">
          <div className="message__header">You (Listening...)</div>
          <div className="message__content">
            {partialText}
            <span className="cursor" />
          </div>
        </div>
      )}
    </div>
  );
};
