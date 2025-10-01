import React, { useState } from 'react';
import type { LeaderboardEntry, Team } from '../types';

interface LeaderboardProps {
  leaderboard: LeaderboardEntry[];
  teams: Team[];
}

const formatScore = (score: number): string => {
  if (score === 0) return 'E';
  if (score > 0) return `+${score}`;
  return score.toString();
};

const getScoreColor = (strokes: number | null, par: number): string => {
  if (strokes === null) return '';
  const diff = strokes - par;
  if (diff <= -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  if (diff === 1) return 'bogey';
  return 'double-bogey';
};

const formatRoundScore = (entry: LeaderboardEntry): string => {
  const currentRoundScore = entry.currentScore; // This is the current round score vs par
  const lastHolePlayed = entry.holesCompleted;

  if (lastHolePlayed === 0) {
    return 'E';
  }

  const scoreText = formatScore(currentRoundScore);

  // If round is complete (18 holes), don't show hole number
  if (lastHolePlayed >= 18) {
    return scoreText;
  }

  return `${scoreText} (${lastHolePlayed})`;
};

const formatTotalScore = (entry: LeaderboardEntry): string => {
  // Calculate total score vs par: sum of all rounds except the currently displayed round
  let totalScore = 0;

  if (entry.roundScores && entry.roundScores.length > 0) {
    // Find the highest round number with scores - that's the current/displayed round
    const currentRoundNumber = Math.max(...entry.roundScores
      .filter((r: { round: number; holeScores: (number | null)[]; }) => r.holeScores.some((s: number | null) => s !== null))
      .map((r: { round: number; }) => r.round)
    );

    // Add all previous rounds to total (even if they have less than 18 holes)
    entry.roundScores.forEach((round: { round: number; holeScores: (number | null)[]; stablefordPoints: (number | null)[]; roundStrokes: number; roundStablefordPoints: number }) => {
      if (round.round < currentRoundNumber && round.roundStrokes > 0) {
        // Calculate par for the number of holes actually played
        const roundPar = round.holeScores.reduce((sum: number, score: number | null, idx: number) =>
          score !== null ? sum + (entry.holePars?.[idx] || 4) : sum, 0
        );
        totalScore += (round.roundStrokes - roundPar);
      }
    });

    // Add current round score
    totalScore += entry.currentScore;
  } else {
    // First round in progress
    totalScore = entry.currentScore;
  }

  return formatScore(totalScore);
};

const formatRoundStableford = (entry: LeaderboardEntry): string => {
  // Current round stableford: points so far - (2 * holes played)
  const currentRoundPoints = entry.stablefordPoints?.slice(0, entry.holesCompleted)
    .reduce((sum: number, points: number | null) => (sum || 0) + (points || 0), 0) || 0;
  const expectedPoints = entry.holesCompleted * 2;
  const stablefordVsPar = currentRoundPoints - expectedPoints;

  if (stablefordVsPar > 0) return `+${stablefordVsPar}p`;
  if (stablefordVsPar === 0) return 'Ep';
  return `${stablefordVsPar}p`;
};

const formatTotalStableford = (entry: LeaderboardEntry): string => {
  // Total stableford: sum of all previous rounds vs par + current round vs par
  let totalStableford = 0;

  if (entry.roundScores && entry.roundScores.length > 0) {
    // Find the highest round number with scores - that's the current/displayed round
    const currentRoundNumber = Math.max(...entry.roundScores
      .filter((r: { round: number; holeScores: (number | null)[]; }) => r.holeScores.some((s: number | null) => s !== null))
      .map((r: { round: number; }) => r.round)
    );

    // Add all previous rounds to total (even if they have less than 18 holes)
    entry.roundScores.forEach((round: { round: number; holeScores: (number | null)[]; stablefordPoints: (number | null)[]; roundStrokes: number; roundStablefordPoints: number }) => {
      if (round.round < currentRoundNumber && round.roundStablefordPoints > 0) {
        // Calculate expected points for the number of holes actually played
        const holesPlayed = round.holeScores.filter((s: number | null) => s !== null).length;
        const expectedPoints = holesPlayed * 2;
        totalStableford += (round.roundStablefordPoints - expectedPoints);
      }
    });

    // Add current round stableford
    const currentRoundPoints = entry.stablefordPoints?.slice(0, entry.holesCompleted)
      .reduce((sum: number, points: number | null) => (sum || 0) + (points || 0), 0) || 0;
    const currentExpected = entry.holesCompleted * 2;
    totalStableford += (currentRoundPoints - currentExpected);
  } else {
    // First round in progress
    const currentRoundPoints = entry.stablefordPoints?.slice(0, entry.holesCompleted)
      .reduce((sum: number, points: number | null) => (sum || 0) + (points || 0), 0) || 0;
    const currentExpected = entry.holesCompleted * 2;
    totalStableford = currentRoundPoints - currentExpected;
  }

  if (totalStableford > 0) return `+${totalStableford}p`;
  if (totalStableford === 0) return 'Ep';
  return `${totalStableford}p`;
};

const calculateOnTheMove = (entry: LeaderboardEntry): { difference: number; nextHoleInfo: string } => {
  if (!entry.roundScores || entry.roundScores.length === 0 || entry.holesCompleted === 0) {
    return { difference: 0, nextHoleInfo: '' };
  }

  // Find completed rounds (18 holes)
  const completedRounds = entry.roundScores.filter((round: { round: number; holeScores: (number | null)[]; stablefordPoints: (number | null)[]; roundStrokes: number; roundStablefordPoints: number }) =>
    round.holeScores.filter((s: number | null) => s !== null).length === 18
  );

  if (completedRounds.length === 0) {
    return { difference: 0, nextHoleInfo: '' };
  }

  // Calculate current round strokes for played holes
  const currentHoleStrokes = entry.holeScores?.slice(0, entry.holesCompleted)
    .reduce((sum: number, strokes: number | null) => (sum || 0) + (strokes || 0), 0) || 0;

  // Find worst completed round up to same number of holes
  let worstRoundStrokes = 0;
  let worstRoundNextHole = 0;
  let maxStrokes = -1;

  completedRounds.forEach((round: { round: number; holeScores: (number | null)[]; stablefordPoints: (number | null)[]; roundStrokes: number; roundStablefordPoints: number }) => {
    const strokesUpToHole = round.holeScores.slice(0, entry.holesCompleted)
      .reduce((sum: number, strokes: number | null) => (sum || 0) + (strokes || 0), 0);

    if ((strokesUpToHole || 0) > maxStrokes) {
      maxStrokes = strokesUpToHole || 0;
      worstRoundStrokes = strokesUpToHole || 0;
      // Get next hole score if available
      if (entry.holesCompleted < 18) {
        worstRoundNextHole = round.holeScores[entry.holesCompleted] || 0;
      }
    }
  });

  const difference = currentHoleStrokes - worstRoundStrokes;
  const nextHoleNumber = entry.holesCompleted + 1;
  const nextHoleInfo = nextHoleNumber <= 18 && worstRoundNextHole > 0
    ? `hole ${nextHoleNumber}: ${worstRoundNextHole}`
    : '';

  return { difference, nextHoleInfo };
};

const getRoundSummaryData = (entry: LeaderboardEntry) => {
  const maxRounds = 10;
  const rounds = [];

  // Add completed rounds
  if (entry.roundScores) {
    entry.roundScores.forEach((round: { round: number; holeScores: (number | null)[]; stablefordPoints: (number | null)[]; roundStrokes: number; roundStablefordPoints: number }, index: number) => {
      if (index < maxRounds) {
        const isCompleted = round.holeScores.filter((s: number | null) => s !== null).length === 18;
        rounds.push({
          roundNumber: round.round,
          strokes: isCompleted ? round.roundStrokes : null,
          points: isCompleted ? round.roundStablefordPoints : null,
          isCompleted
        });
      }
    });
  }

  // Add current round if it's not already included
  const currentRound = entry.roundScores?.find((r: { round: number; holeScores: (number | null)[]; stablefordPoints: (number | null)[]; roundStrokes: number; roundStablefordPoints: number }) => r.round === (entry.totalRounds || 1));
  if (!currentRound && entry.holesCompleted > 0 && rounds.length < maxRounds) {
    const currentRoundStrokes = entry.holeScores?.slice(0, entry.holesCompleted)
      .reduce((sum: number, strokes: number | null) => (sum || 0) + (strokes || 0), 0) || 0;
    const currentRoundPoints = entry.stablefordPoints?.slice(0, entry.holesCompleted)
      .reduce((sum: number, points: number | null) => (sum || 0) + (points || 0), 0) || 0;
    const currentPar = entry.holePars?.slice(0, entry.holesCompleted)
      .reduce((sum: number, par: number) => sum + par, 0) || (entry.holesCompleted * 4); // Estimate par

    const currentVsPar = currentRoundStrokes - currentPar;
    const currentVsExpected = currentRoundPoints - (entry.holesCompleted * 2);

    rounds.push({
      roundNumber: entry.totalRounds || 1,
      strokes: null,
      points: null,
      isCompleted: false,
      currentVsPar,
      currentVsExpected,
      holesPlayed: entry.holesCompleted
    });
  }

  return rounds;
};

const getPlayerTeamColor = (playerName: string, teams: Team[]): string | null => {
  for (const team of teams) {
    if (team.players.some(player =>
      player.toLowerCase() === playerName.toLowerCase() ||
      playerName.toLowerCase().includes(player.toLowerCase()) ||
      player.toLowerCase().includes(playerName.toLowerCase())
    )) {
      return team.color;
    }
  }
  return null;
};

export const Leaderboard: React.FC<LeaderboardProps> = ({ leaderboard, teams }) => {
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'score' | 'stableford'>('score');

  const togglePlayerExpansion = (playerId: string) => {
    const newExpanded = new Set(expandedPlayers);
    if (newExpanded.has(playerId)) {
      newExpanded.delete(playerId);
    } else {
      newExpanded.add(playerId);
    }
    setExpandedPlayers(newExpanded);
  };

  // Sort leaderboard based on selected criteria
  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    if (sortBy === 'stableford') {
      // Sort by stableford points (higher is better)
      const aStablefordVsPar = a.stablefordVsPar || 0;
      const bStablefordVsPar = b.stablefordVsPar || 0;
      if (aStablefordVsPar !== bStablefordVsPar) {
        return bStablefordVsPar - aStablefordVsPar;
      }
      // Secondary sort by holes completed
      return b.holesCompleted - a.holesCompleted;
    } else {
      // Sort by score (stroke play) - lower is better
      if (a.currentScore !== b.currentScore) {
        return a.currentScore - b.currentScore;
      }
      // Secondary sort by holes completed
      return b.holesCompleted - a.holesCompleted;
    }
  });

  // Update positions based on sort order
  sortedLeaderboard.forEach((entry: LeaderboardEntry, index: number) => {
    entry.position = index + 1;
  });

  return (
    <div className="leaderboard">
      <div className="leaderboard-header-section">
        <h2>Leaderboard</h2>
        <div className="sort-controls">
          <span className="sort-label">Sort by:</span>
          <button
            className={`sort-btn ${sortBy === 'score' ? 'active' : ''}`}
            onClick={() => setSortBy('score')}
          >
            Score
          </button>
          <button
            className={`sort-btn ${sortBy === 'stableford' ? 'active' : ''}`}
            onClick={() => setSortBy('stableford')}
          >
            Stableford
          </button>
        </div>
      </div>
      <div className="leaderboard-table">
        <div className="leaderboard-header">
          <div className="pos">Pos</div>
          <div className="player">Player</div>
          <div className="round">Round</div>
          <div className="total">Total</div>
          <div className="expand">Details</div>
        </div>

        {sortedLeaderboard.map((entry: LeaderboardEntry, index: number) => (
          <div key={entry.playerId} className="player-section">
            <div className={`leaderboard-row ${index === 0 ? 'leader' : ''}`}>
              <div className="pos">{entry.position}</div>
              <div className="player">
                <div className="player-name">
                  {getPlayerTeamColor(entry.playerName, teams) && (
                    <span
                      className="team-color-dot"
                      style={{ backgroundColor: getPlayerTeamColor(entry.playerName, teams)! }}
                    ></span>
                  )}
                  {entry.playerName}
                </div>
              </div>
              <div className="round">
                <div className="score-row">
                  <span className="score-bold">{formatRoundScore(entry).split(' (')[0]}</span>
                  {formatRoundScore(entry).includes('(') && (
                    <span className="hole-light"> ({formatRoundScore(entry).split('(')[1]}</span>
                  )}
                </div>
                <div className="stableford-row">{formatRoundStableford(entry)}</div>
              </div>
              <div className="total">
                <div className="score-row">{formatTotalScore(entry)}</div>
                <div className="stableford-row">{formatTotalStableford(entry)}</div>
              </div>
              <div className="expand">
                <button
                  className="expand-btn"
                  onClick={() => togglePlayerExpansion(entry.playerId)}
                >
                  {expandedPlayers.has(entry.playerId) ? '−' : '+'}
                </button>
              </div>
            </div>

            {expandedPlayers.has(entry.playerId) && entry.holeScores && entry.holePars && (
              <div className="scorecard-detail">
                <div className="round-summary-info">
                  <h4>Round Summary</h4>
                  <div className="round-summary-table">
                    <div className="round-header-row">
                      {getRoundSummaryData(entry).map((round: any) => (
                        <div key={round.roundNumber} className="round-header">
                          R{round.roundNumber}
                        </div>
                      ))}
                    </div>
                    <div className="round-strokes-row">
                      {getRoundSummaryData(entry).map((round: any) => (
                        <div key={`strokes-${round.roundNumber}`} className="round-cell">
                          {round.isCompleted ? round.strokes :
                           round.currentVsPar !== undefined ?
                           `${round.currentVsPar >= 0 ? '+' : ''}${round.currentVsPar}` :
                           '-'}
                        </div>
                      ))}
                    </div>
                    <div className="round-points-row">
                      {getRoundSummaryData(entry).map((round: any) => (
                        <div key={`points-${round.roundNumber}`} className="round-cell">
                          {round.isCompleted ? round.points :
                           round.currentVsExpected !== undefined ?
                           `${round.currentVsExpected >= 0 ? '+' : ''}${round.currentVsExpected}p` :
                           '-'}
                        </div>
                      ))}
                    </div>
                  </div>

                  {entry.holesCompleted > 0 && entry.holesCompleted < 18 && (
                    <div className="on-the-move">
                      <span className="on-the-move-label">On the move:</span>
                      <span className={`on-the-move-value ${calculateOnTheMove(entry).difference >= 0 ? 'positive' : 'negative'}`}>
                        {calculateOnTheMove(entry).difference >= 0 ? '+' : ''}{calculateOnTheMove(entry).difference}
                      </span>
                      {calculateOnTheMove(entry).nextHoleInfo && (
                        <span className="next-hole-info">{calculateOnTheMove(entry).nextHoleInfo}</span>
                      )}
                    </div>
                  )}
                </div>

                {entry.roundScores && entry.totalRounds && entry.totalRounds > 1 ? (
                  // Multi-round display - only show rounds with data
                  entry.roundScores
                    .filter((roundData: { round: number; holeScores: (number | null)[]; stablefordPoints: (number | null)[]; roundStrokes: number; roundStablefordPoints: number }) => roundData.holeScores.some((score: number | null) => score !== null))
                    .map((roundData: { round: number; holeScores: (number | null)[]; stablefordPoints: (number | null)[]; roundStrokes: number; roundStablefordPoints: number }) => (
                    <div key={roundData.round} className="multi-round-scorecard">
                      <div className="scorecard-section">
                        <h4>Round {roundData.round} - Front 9</h4>
                        <div className="scorecard">
                          <div className="hole-row hole-numbers">
                            {Array.from({length: 9}, (_, i) => (
                              <div key={i} className="hole-cell hole-number">{i + 1}</div>
                            ))}
                            <div className="hole-cell total-cell">OUT</div>
                          </div>
                          <div className="hole-row par-row">
                            {(entry.holePars || []).slice(0, 9).map((par: number, i: number) => (
                              <div key={i} className="hole-cell par-cell">{par}</div>
                            ))}
                            <div className="hole-cell total-cell">
                              {(entry.holePars || []).slice(0, 9).reduce((sum: number, par: number) => sum + par, 0)}
                            </div>
                          </div>
                          <div className="hole-row score-row">
                            {roundData.holeScores.slice(0, 9).map((score: number | null, i: number) => (
                              <div
                                key={i}
                                className={`hole-cell score-cell ${getScoreColor(score, (entry.holePars || [])[i])}`}
                              >
                                {score || '-'}
                              </div>
                            ))}
                            <div className="hole-cell total-cell">
                              {roundData.holeScores.slice(0, 9).reduce((sum: number, score: number | null) => (sum || 0) + (score || 0), 0) || '-'}
                            </div>
                          </div>
                          <div className="hole-row stableford-row">
                            {roundData.stablefordPoints.slice(0, 9).map((points: number | null, i: number) => (
                              <div key={i} className="hole-cell stableford-cell">
                                <small>{points !== null && points !== undefined ? points : '-'}</small>
                              </div>
                            ))}
                            <div className="hole-cell total-cell">
                              <small>{roundData.stablefordPoints.slice(0, 9).reduce((sum: number, points: number | null) => (sum || 0) + (points || 0), 0) || '-'}</small>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="scorecard-section">
                        <h4>Round {roundData.round} - Back 9</h4>
                        <div className="scorecard">
                          <div className="hole-row hole-numbers">
                            {Array.from({length: 9}, (_, i) => (
                              <div key={i + 9} className="hole-cell hole-number">{i + 10}</div>
                            ))}
                            <div className="hole-cell total-cell">IN</div>
                          </div>
                          <div className="hole-row par-row">
                            {(entry.holePars || []).slice(9, 18).map((par: number, i: number) => (
                              <div key={i + 9} className="hole-cell par-cell">{par}</div>
                            ))}
                            <div className="hole-cell total-cell">
                              {(entry.holePars || []).slice(9, 18).reduce((sum: number, par: number) => sum + par, 0)}
                            </div>
                          </div>
                          <div className="hole-row score-row">
                            {roundData.holeScores.slice(9, 18).map((score: number | null, i: number) => (
                              <div
                                key={i + 9}
                                className={`hole-cell score-cell ${getScoreColor(score, (entry.holePars || [])[i + 9])}`}
                              >
                                {score || '-'}
                              </div>
                            ))}
                            <div className="hole-cell total-cell">
                              {roundData.holeScores.slice(9, 18).reduce((sum: number, score: number | null) => (sum || 0) + (score || 0), 0) || '-'}
                            </div>
                          </div>
                          <div className="hole-row stableford-row">
                            {roundData.stablefordPoints.slice(9, 18).map((points: number | null, i: number) => (
                              <div key={i + 9} className="hole-cell stableford-cell">
                                <small>{points !== null && points !== undefined ? points : '-'}</small>
                              </div>
                            ))}
                            <div className="hole-cell total-cell">
                              <small>{roundData.stablefordPoints.slice(9, 18).reduce((sum: number, points: number | null) => (sum || 0) + (points || 0), 0) || '-'}</small>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="scorecard-totals">
                        <div className="total-item">
                          <span className="total-label">Round {roundData.round} Total:</span>
                          <span className="total-value">{roundData.roundStrokes || '-'}</span>
                        </div>
                        <div className="total-item">
                          <span className="total-label">Round {roundData.round} Points:</span>
                          <span className="total-value">{roundData.roundStablefordPoints || 0}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  // Single round display (existing code)
                <div className="single-round-scorecard">
                <div className="scorecard-section">
                  <h4>Front 9</h4>
                  <div className="scorecard">
                    <div className="hole-row hole-numbers">
                      {Array.from({length: 9}, (_, i) => (
                        <div key={i} className="hole-cell hole-number">{i + 1}</div>
                      ))}
                      <div className="hole-cell total-cell">OUT</div>
                    </div>
                    <div className="hole-row par-row">
                      {entry.holePars.slice(0, 9).map((par: number, i: number) => (
                        <div key={i} className="hole-cell par-cell">{par}</div>
                      ))}
                      <div className="hole-cell total-cell">
                        {entry.holePars.slice(0, 9).reduce((sum: number, par: number) => sum + par, 0)}
                      </div>
                    </div>
                    <div className="hole-row score-row">
                      {entry.holeScores.slice(0, 9).map((score: number | null, i: number) => (
                        <div
                          key={i}
                          className={`hole-cell score-cell ${getScoreColor(score, (entry.holePars || [])[i])}`}
                        >
                          {score || '-'}
                        </div>
                      ))}
                      <div className="hole-cell total-cell">
                        {entry.holeScores.slice(0, 9).reduce((sum: number, score: number | null) => (sum || 0) + (score || 0), 0) || '-'}
                      </div>
                    </div>
                    <div className="hole-row stableford-row">
                      {(entry.stablefordPoints || []).slice(0, 9).map((points: number | null, i: number) => (
                        <div key={i} className="hole-cell stableford-cell">
                          <small>{points !== null && points !== undefined ? points : '-'}</small>
                        </div>
                      ))}
                      <div className="hole-cell total-cell">
                        <small>{(entry.stablefordPoints || []).slice(0, 9).reduce((sum: number, points: number | null) => (sum || 0) + (points || 0), 0) || '-'}</small>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="scorecard-section">
                  <h4>Back 9</h4>
                  <div className="scorecard">
                    <div className="hole-row hole-numbers">
                      {Array.from({length: 9}, (_, i) => (
                        <div key={i + 9} className="hole-cell hole-number">{i + 10}</div>
                      ))}
                      <div className="hole-cell total-cell">IN</div>
                    </div>
                    <div className="hole-row par-row">
                      {entry.holePars.slice(9, 18).map((par: number, i: number) => (
                        <div key={i + 9} className="hole-cell par-cell">{par}</div>
                      ))}
                      <div className="hole-cell total-cell">
                        {entry.holePars.slice(9, 18).reduce((sum: number, par: number) => sum + par, 0)}
                      </div>
                    </div>
                    <div className="hole-row score-row">
                      {entry.holeScores.slice(9, 18).map((score: number | null, i: number) => (
                        <div
                          key={i + 9}
                          className={`hole-cell score-cell ${getScoreColor(score, (entry.holePars || [])[i + 9])}`}
                        >
                          {score || '-'}
                        </div>
                      ))}
                      <div className="hole-cell total-cell">
                        {entry.holeScores.slice(9, 18).reduce((sum: number, score: number | null) => (sum || 0) + (score || 0), 0) || '-'}
                      </div>
                    </div>
                    <div className="hole-row stableford-row">
                      {(entry.stablefordPoints || []).slice(9, 18).map((points: number | null, i: number) => (
                        <div key={i + 9} className="hole-cell stableford-cell">
                          <small>{points !== null && points !== undefined ? points : '-'}</small>
                        </div>
                      ))}
                      <div className="hole-cell total-cell">
                        <small>{(entry.stablefordPoints || []).slice(9, 18).reduce((sum: number, points: number | null) => (sum || 0) + (points || 0), 0) || '-'}</small>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="scorecard-totals">
                  <div className="total-item">
                    <span className="total-label">Total:</span>
                    <span className="total-value">{entry.totalStrokes}</span>
                  </div>
                  <div className="total-item">
                    <span className="total-label">To Par:</span>
                    <span className="total-value">{formatScore(entry.currentScore)}</span>
                  </div>
                  <div className="total-item">
                    <span className="total-label">Holes Completed:</span>
                    <span className="total-value">{entry.holesCompleted}/18</span>
                  </div>
                </div>
                </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {sortedLeaderboard.length === 0 && (
        <div className="no-scores">
          <p>No scores recorded yet</p>
        </div>
      )}
    </div>
  );
};