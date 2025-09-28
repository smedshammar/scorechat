import React from 'react';

interface PlayerScore {
  playerId: string;
  playerName: string;
  holeScores: Record<number, number | null>;
}

interface ScoreVerificationGridProps {
  playerScores: PlayerScore[];
  onRemovePlayer: (playerId: string) => void;
  onUpdateScore: (playerId: string, hole: number, score: number | null) => void;
}

export const ScoreVerificationGrid: React.FC<ScoreVerificationGridProps> = ({
  playerScores,
  onRemovePlayer,
  onUpdateScore,
}) => {
  // Helper function to get player initials
  const getPlayerInitials = (name: string): string => {
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3); // Max 3 characters
  };

  if (playerScores.length === 0) {
    return (
      <div className="score-verification-grid">
        <div className="grid-header">
          <h3>Score Verification</h3>
          <p className="grid-description">
            Players will appear here as you mention them during recording
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="score-verification-grid">
      <div className="grid-header">
        <h3>Score Verification</h3>
        <p className="grid-description">
          Verify and edit scores for your group
        </p>
      </div>

      {/* Front 9 */}
      <div className="scorecard-section">
        <h4>Front 9</h4>
        <div className="scorecard">
          {/* Hole numbers row */}
          <div className="hole-row hole-numbers">
            <div className="hole-cell player-header-empty"></div>
            {Array.from({length: 9}, (_, i) => (
              <div key={i} className="hole-cell hole-number">{i + 1}</div>
            ))}
            <div className="hole-cell total-cell">OUT</div>
          </div>

          {/* Player score rows */}
          {playerScores.map(player => {
            const frontNineTotal = Array.from({length: 9}, (_, i) => i + 1)
              .reduce((sum, hole) => {
                const score = player.holeScores[hole];
                return sum + (score || 0);
              }, 0);

            return (
              <div key={player.playerId} className="hole-row score-row">
                <div
                  className="hole-cell player-initials-cell"
                  title={player.playerName}
                >
                  {getPlayerInitials(player.playerName)}
                </div>
                {Array.from({length: 9}, (_, i) => {
                  const hole = i + 1;
                  return (
                    <div key={hole} className="hole-cell score-cell">
                      <input
                        type="number"
                        min="1"
                        max="15"
                        className="score-input"
                        value={player.holeScores[hole] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          const score = value === '' ? null : parseInt(value);
                          onUpdateScore(player.playerId, hole, score);
                        }}
                        placeholder=""
                      />
                    </div>
                  );
                })}
                <div className="hole-cell total-cell">{frontNineTotal || ''}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Back 9 */}
      <div className="scorecard-section">
        <h4>Back 9</h4>
        <div className="scorecard">
          {/* Hole numbers row */}
          <div className="hole-row hole-numbers">
            <div className="hole-cell player-header-empty"></div>
            {Array.from({length: 9}, (_, i) => (
              <div key={i + 9} className="hole-cell hole-number">{i + 10}</div>
            ))}
            <div className="hole-cell total-cell">IN</div>
            <div className="hole-cell action-header-empty"></div>
          </div>

          {/* Player score rows */}
          {playerScores.map(player => {
            const backNineTotal = Array.from({length: 9}, (_, i) => i + 10)
              .reduce((sum, hole) => {
                const score = player.holeScores[hole];
                return sum + (score || 0);
              }, 0);

            return (
              <div key={player.playerId} className="hole-row score-row">
                <div
                  className="hole-cell player-initials-cell"
                  title={player.playerName}
                >
                  {getPlayerInitials(player.playerName)}
                </div>
                {Array.from({length: 9}, (_, i) => {
                  const hole = i + 10;
                  return (
                    <div key={hole} className="hole-cell score-cell">
                      <input
                        type="number"
                        min="1"
                        max="15"
                        className="score-input"
                        value={player.holeScores[hole] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          const score = value === '' ? null : parseInt(value);
                          onUpdateScore(player.playerId, hole, score);
                        }}
                        placeholder=""
                      />
                    </div>
                  );
                })}
                <div className="hole-cell total-cell">{backNineTotal || ''}</div>
                <div className="hole-cell action-cell">
                  <button
                    className="remove-btn"
                    onClick={() => onRemovePlayer(player.playerId)}
                    title={`Remove ${player.playerName}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-footer">
        <p className="helper-text">
          💡 Hover over initials to see full names • Enter scores directly or remove players mentioned by mistake
        </p>
      </div>
    </div>
  );
};