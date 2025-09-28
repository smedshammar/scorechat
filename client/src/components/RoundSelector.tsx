import React from 'react';

interface RoundSelectorProps {
  currentRound: number;
  totalRounds: number;
  selectedRound: number | null;
  onRoundSelect: (round: number | null) => void;
  onAdvanceRound?: () => void;
}

export const RoundSelector: React.FC<RoundSelectorProps> = ({
  currentRound,
  totalRounds,
  selectedRound,
  onRoundSelect,
  onAdvanceRound
}) => {
  return (
    <div className="round-selector">
      <div className="round-selector-header">
        <h3>Tournament Rounds</h3>
        <div className="current-round-info">
          <span className="current-round-label">Active Round:</span>
          <span className="current-round-value">{currentRound}/{totalRounds}</span>
        </div>
      </div>

      <div className="round-buttons">
        <button
          className={`round-btn ${selectedRound === null ? 'active' : ''}`}
          onClick={() => onRoundSelect(null)}
        >
          Total
        </button>

        {Array.from({ length: totalRounds }, (_, i) => i + 1).map(round => (
          <button
            key={round}
            className={`round-btn ${selectedRound === round ? 'active' : ''} ${round === currentRound ? 'current' : ''}`}
            onClick={() => onRoundSelect(round)}
          >
            Round {round}
          </button>
        ))}

        {onAdvanceRound && currentRound < totalRounds && (
          <button
            className="round-btn advance-btn"
            onClick={onAdvanceRound}
          >
            Advance to Round {currentRound + 1}
          </button>
        )}
      </div>

      <div className="round-info">
        {selectedRound === null ? (
          <p>Showing total scores across all rounds</p>
        ) : (
          <p>Showing scores for Round {selectedRound}</p>
        )}
      </div>
    </div>
  );
};