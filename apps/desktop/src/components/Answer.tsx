import React, { useEffect, useRef } from 'react';

interface AnswerSource {
  title: string;
  url: string;
}

interface AnswerProps {
  answerText: string;
  isStreaming: boolean;
  sources: AnswerSource[];
  searchProgress: string;
  action: string;
}

export const Answer: React.FC<AnswerProps> = ({
  answerText,
  isStreaming,
  sources,
  searchProgress,
  action,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [answerText]);

  const hasContent = answerText || searchProgress;

  return (
    <div className="answer-panel" ref={scrollRef}>
      <div className="answer-panel__label">
        Answer
        {action === 'web_search' && (
          <span style={{ fontSize: '0.625rem', color: 'var(--accent-secondary)' }}>🌐 Web</span>
        )}
      </div>

      {searchProgress && (
        <div className="search-progress">
          <div className="search-progress__spinner" />
          <span>{searchProgress}</span>
        </div>
      )}

      {!hasContent && (
        <div className="answer-panel__empty">
          <div className="answer-panel__empty-icon">💬</div>
          <div>
            Ask a question and the AI will answer here.
            <br />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              Press ⌘⇧Space to start listening
            </span>
          </div>
        </div>
      )}

      {answerText && (
        <div className="answer-panel__text">
          {answerText}
          {isStreaming && <span className="answer-panel__cursor" />}
        </div>
      )}

      {sources.length > 0 && (
        <div className="sources">
          <div className="sources__label">Sources</div>
          {sources.map((source, i) => (
            <a
              key={i}
              className="source-link"
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              title={source.url}
            >
              <span className="source-link__icon">🔗</span>
              <span className="source-link__url">
                {source.title || new URL(source.url).hostname}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
