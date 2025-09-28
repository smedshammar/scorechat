import React from 'react';

interface TranscriptionEntry {
  id: string;
  text: string;
  timestamp: number;
  processed?: boolean;
}

interface TranscriptionLogProps {
  transcriptions: TranscriptionEntry[];
}

export const TranscriptionLog: React.FC<TranscriptionLogProps> = ({ transcriptions }) => {
  return (
    <div className="transcription-log">
      <h3>Recent Transcriptions</h3>
      <div className="transcription-entries">
        {transcriptions.map((entry) => (
          <div key={entry.id} className={`transcription-entry ${entry.processed ? 'processed' : 'pending'}`}>
            <div className="timestamp">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </div>
            <div className="text">{entry.text}</div>
            <div className="status">
              {entry.processed ? '✅' : '⏳'}
            </div>
          </div>
        ))}
      </div>

      {transcriptions.length === 0 && (
        <div className="no-transcriptions">
          <p>No transcriptions yet. Start recording to see them here.</p>
        </div>
      )}
    </div>
  );
};