import React, { useState } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { apiService } from '../services/api';

interface AudioRecorderProps {
  onTranscription?: (text: string) => void;
  onError?: (error: string) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscription, onError }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTranscription, setLastTranscription] = useState<string>('');

  const handleAudioData = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const result = await apiService.uploadAudio(audioBlob);
      setLastTranscription(result.transcription);
      onTranscription?.(result.transcription);
    } catch (error) {
      console.error('Audio upload error:', error);
      const errorMessage = 'Failed to process audio recording';
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleError = (error: string) => {
    console.error('Recording error:', error);
    onError?.(error);
  };

  const { isRecording, isSupported, toggleRecording } = useAudioRecorder({
    onAudioData: handleAudioData,
    onError: handleError
  });

  if (!isSupported) {
    return (
      <div className="audio-recorder error">
        <p>Audio recording is not supported in this browser</p>
      </div>
    );
  }

  return (
    <div className="audio-recorder">
      <button
        className={`record-button ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}
        onClick={toggleRecording}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <span>Processing...</span>
        ) : isRecording ? (
          <span>🔴 Stop Recording</span>
        ) : (
          <span>🎤 Start Recording</span>
        )}
      </button>

      {lastTranscription && (
        <div className="transcription-display">
          <h3>Last Recording:</h3>
          <p>{lastTranscription}</p>
        </div>
      )}
    </div>
  );
};