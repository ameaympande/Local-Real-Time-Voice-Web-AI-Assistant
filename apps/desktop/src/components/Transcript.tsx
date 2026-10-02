import React, { useEffect, useRef } from 'react';

interface TranscriptProps {
  transcripts: Array<{ text: string; isFinal: boolean; timestamp: number }>;
  partialText: string;
}

export const Transcript: React.FC<TranscriptProps> = ({ transcripts, partialText }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, partialText]);

  const hasContent = transcripts.length > 0 || partialText;

  return (
    <div className="transcript-panel" ref={scrollRef}>
      <div className="transcript-panel__label">Transcript</div>

      {!hasContent && (
        <div className="transcript-panel__empty">
          Waiting for speech...
        </div>
      )}

      {transcripts.map((t, i) => (
        <div key={i} className="transcript-panel__text">
          {t.text}
        </div>
      ))}

      {partialText && (
        <div className="transcript-panel__text transcript-panel__text--partial">
          {partialText}
          <span className="answer-panel__cursor" />
        </div>
      )}
    </div>
  );
};
