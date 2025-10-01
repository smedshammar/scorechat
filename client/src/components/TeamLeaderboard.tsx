import React, { useState, useEffect } from 'react';
import type { TeamLeaderboardEntry, TeamSidegame } from '../types';

interface TeamLeaderboardProps {
  tournament: any;
  currentRound: number;
  webSocketUpdate?: { type: string; data: any } | null;
}

export const TeamLeaderboard: React.FC<TeamLeaderboardProps> = ({
  tournament,
  currentRound,
  webSocketUpdate,
}) => {
  const [teamLeaderboard, setTeamLeaderboard] = useState<TeamLeaderboardEntry[]>([]);
  const [currentSidegame, setCurrentSidegame] = useState<TeamSidegame | null>(null);
  const [liveScorecard, setLiveScorecard] = useState<{ [hole: number]: { [teamId: string]: number } }>({});
  const [allTimeTeamScores, setAllTimeTeamScores] = useState<{ [teamId: string]: { totalScore: number; currentRoundScore: number; rounds: number } }>({});

  useEffect(() => {
    if (tournament?.id) {
      loadCurrentSidegame();
    }
  }, [tournament?.id, currentRound]);

  useEffect(() => {
    if (currentSidegame) {
      loadAllTimeTeamScores();
    }
  }, [currentSidegame, currentRound]);

  const loadCurrentSidegame = async () => {
    try {
      console.log('Loading current sidegame for tournament:', tournament.id, 'round:', currentRound);
      const response = await fetch(`/api/tournament/${tournament.id}/round/${currentRound}/sidegame`);
      if (response.ok) {
        const sidegame = await response.json();
        console.log('Loaded sidegame:', sidegame);
        setCurrentSidegame(sidegame);

        // Load team leaderboard
        const leaderboardResponse = await fetch(`/api/sidegame/${sidegame.id}/leaderboard`);
        if (leaderboardResponse.ok) {
          const leaderboard = await leaderboardResponse.json();
          console.log('Loaded team leaderboard:', leaderboard);
          setTeamLeaderboard(leaderboard);
        }

        // Load live scorecard for sum-match
        if (sidegame.gameType === 'sum-match') {
          const scorecardResponse = await fetch(`/api/sidegame/${sidegame.id}/sum-match/scorecard`);
          if (scorecardResponse.ok) {
            const scorecard = await scorecardResponse.json();
            console.log('Loaded live scorecard:', scorecard);
            setLiveScorecard(scorecard);
          }
        }
      } else if (response.status === 404) {
        console.log('No sidegame found for this round');
        setCurrentSidegame(null);
        setTeamLeaderboard([]);
        setLiveScorecard({});
      }
    } catch (err) {
      console.error('Failed to load team sidegame:', err);
    }
  };

  const loadAllTimeTeamScores = async () => {
    try {
      // Load the leaderboard to get player scores across all rounds
      const response = await fetch(`/api/tournament/${tournament.id}/leaderboard`);
      if (!response.ok) return;

      const leaderboard = await response.json();

      // Get teams from the sidegame
      if (!currentSidegame?.teams) return;

      // Calculate total scores for each team across all rounds (including current)
      const teamScores: { [teamId: string]: { totalScore: number; currentRoundScore: number; rounds: number } } = {};

      currentSidegame.teams.forEach(team => {
        let teamTotalScore = 0;
        let teamCurrentRoundScore = 0;
        let teamRoundsPlayed = 0;

        team.players.forEach(playerName => {
          // Find player in leaderboard
          const playerEntry = leaderboard.find((entry: any) =>
            entry.playerName.toLowerCase().includes(playerName.toLowerCase()) ||
            playerName.toLowerCase().includes(entry.playerName.toLowerCase())
          );

          if (playerEntry) {
            // Add current round score
            teamCurrentRoundScore += playerEntry.currentScore || 0;

            if (playerEntry.roundScores) {
              // Sum scores from all rounds (including current)
              playerEntry.roundScores.forEach((round: any) => {
                if (round.roundStrokes > 0) {
                  const roundPar = round.holeScores.reduce((sum: number, score: number | null, idx: number) =>
                    score !== null ? sum + (playerEntry.holePars?.[idx] || 4) : sum, 0
                  );
                  const roundScore = round.roundStrokes - roundPar;

                  // For completed rounds (before current)
                  if (round.round < currentRound) {
                    teamTotalScore += roundScore;
                  }

                  if (teamRoundsPlayed === 0 || round.round > teamRoundsPlayed) {
                    teamRoundsPlayed = round.round;
                  }
                }
              });
            }

            // Add current round to total
            teamTotalScore += teamCurrentRoundScore;
          }
        });

        teamScores[team.id] = {
          totalScore: teamTotalScore,
          currentRoundScore: teamCurrentRoundScore,
          rounds: teamRoundsPlayed
        };
      });

      setAllTimeTeamScores(teamScores);
    } catch (err) {
      console.error('Failed to load all-time team scores:', err);
    }
  };

  // Handle WebSocket updates from parent
  useEffect(() => {
    if (!webSocketUpdate || !currentSidegame) return;

    console.log('TeamLeaderboard received WebSocket update:', webSocketUpdate.type, webSocketUpdate.data);

    if (webSocketUpdate.type === 'team_leaderboard_update' &&
        webSocketUpdate.data.sidegameId === currentSidegame.id) {
      console.log('Updating team leaderboard with:', webSocketUpdate.data.leaderboard);
      setTeamLeaderboard(webSocketUpdate.data.leaderboard);
    }

    if (webSocketUpdate.type === 'team_match_update' &&
        webSocketUpdate.data.sidegameId === currentSidegame.id) {
      console.log('Team match update received, refreshing sidegame data');
      // Force refresh of all sidegame data
      loadCurrentSidegame();
    }
  }, [webSocketUpdate, currentSidegame]);

  if (!currentSidegame || teamLeaderboard.length === 0) {
    return null;
  }

  // Get holes played differently for different game types
  const holesPlayed = currentSidegame?.gameType === 'sum-match'
    ? Object.keys(liveScorecard).map(h => parseInt(h)).sort((a, b) => a - b)
    : currentSidegame?.matches
      ? [...new Set(currentSidegame.matches.map(m => m.hole))].sort((a, b) => a - b)
      : [];

  // Debug logging to understand what's happening
  if (currentSidegame?.gameType === 'all-vs-all') {
    console.log('All-vs-all debug data:', {
      gameType: currentSidegame.gameType,
      hasMatches: !!currentSidegame.matches,
      matchesLength: currentSidegame.matches?.length || 0,
      holesPlayed,
      hasGroupings: !!currentSidegame.groupings,
      groupingsLength: currentSidegame.groupings?.length || 0,
      webSocketUpdate,
      currentSidegame
    });
  }



  return (
    <div className="team-leaderboard">
      <div className="team-leaderboard-header">
        <h2>Team Sidegame - Round {currentRound}</h2>
        <div className="game-type-badge">
          {currentSidegame.gameType === 'sum-match' ? 'Sum Match' : 'All vs All'}
        </div>
      </div>

      {/* Team Points Leaderboard */}
      <div className="team-standings">
        <h3>Team Standings - Round {currentRound}</h3>
        <div className="team-standings-grid">
          {teamLeaderboard.map(team => (
            <div key={team.teamId} className="team-standing">
              <div className="team-rank">#{team.position}</div>
              <div
                className="team-color-indicator"
                style={{ backgroundColor: team.teamColor }}
              ></div>
              <div className="team-info">
                <div className="team-name">{team.teamName}</div>
                <div className="team-points">
                  {team.totalPoints.toFixed(1)} points
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Score Leaderboard */}
      {Object.keys(allTimeTeamScores).length > 0 && (
        <div className="team-total-status">
          <h3>Team Score Leaderboard</h3>
          <div className="team-total-grid">
            {currentSidegame.teams
              .map(team => ({
                ...team,
                ...allTimeTeamScores[team.id]
              }))
              .sort((a, b) => (a.totalScore || 0) - (b.totalScore || 0))
              .map(team => (
                <div key={team.id} className="team-total-item">
                  <div
                    className="team-color-indicator"
                    style={{ backgroundColor: team.color }}
                  ></div>
                  <div className="team-total-info">
                    <div className="team-name">{team.name}</div>
                    <div className="team-scores">
                      <div className="team-score-column">
                        <span className="score-label">Round {currentRound}</span>
                        <div className={`team-score ${(team.currentRoundScore || 0) === 0 ? 'even' : (team.currentRoundScore || 0) < 0 ? 'under' : 'over'}`}>
                          {(team.currentRoundScore || 0) === 0 ? 'E' : (team.currentRoundScore || 0) > 0 ? `+${team.currentRoundScore}` : team.currentRoundScore}
                        </div>
                      </div>
                      <div className="team-score-column">
                        <span className="score-label">Total</span>
                        <div className={`team-score team-total-score ${(team.totalScore || 0) === 0 ? 'even' : (team.totalScore || 0) < 0 ? 'under' : 'over'}`}>
                          {(team.totalScore || 0) === 0 ? 'E' : (team.totalScore || 0) > 0 ? `+${team.totalScore}` : team.totalScore}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
          <p className="team-total-description">
            Combined team score vs par for round {currentRound} and overall total
          </p>
        </div>
      )}

      {/* Live Sum-Match Scorecard */}
      {currentSidegame.gameType === 'sum-match' && holesPlayed.length > 0 && (
        <div className="live-scorecard">
          <h3>Hole-by-Hole Results</h3>
          <div className="scorecard-table">
            <div className="scorecard-header">
              <div className="hole-label">Hole</div>
              {holesPlayed.map(hole => (
                <div key={hole} className="hole-number">{hole}</div>
              ))}
              <div className="total-label">Total</div>
            </div>

            {teamLeaderboard.map(team => {
              const teamScores = holesPlayed.map(hole => liveScorecard[hole]?.[team.teamId] || 0);
              const totalScore = teamScores.reduce((sum, score) => sum + score, 0);

              return (
                <div key={team.teamId} className="team-scorecard-row">
                  <div className="team-name-cell">
                    <div
                      className="team-color-dot"
                      style={{ backgroundColor: team.teamColor }}
                    ></div>
                    <span className="team-name-short">
                      {team.teamName.replace(' Team', '')}
                    </span>
                  </div>

                  {teamScores.map((score, index) => (
                    <div key={holesPlayed[index]} className="score-cell">
                      {score === 0 ? 'E' : score > 0 ? `+${score}` : `${score}`}
                    </div>
                  ))}

                  <div className="total-cell">
                    <strong>{totalScore === 0 ? 'E' : totalScore > 0 ? `+${totalScore}` : `${totalScore}`}</strong>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="scorecard-legend">
            <p><strong>Sum Match:</strong> Teams compete by total strokes vs par per hole</p>
            <p><strong>Scoring:</strong> Best team on hole gets +1 point, worst team gets -1 point</p>
          </div>
        </div>
      )}

      {/* All vs All Results */}
      {currentSidegame.gameType === 'all-vs-all' && (
        <div className="all-vs-all-info">
          <h3>Match Play Results</h3>
          <p>Individual matches within groups - points awarded for head-to-head wins</p>

          {currentSidegame.groupings && (
            <div className="groupings-info">
              <h4>Groups and Match Results:</h4>
              {currentSidegame.groupings.map((group, groupIndex) => (
                <div key={groupIndex} className="group-matches">
                  <div className="group-header">
                    <strong>Group {groupIndex + 1}:</strong> {group.join(', ')}
                  </div>

                  {/* Show match information for this group */}
                  <div className="group-matches-table">
                    {(holesPlayed.length > 0 && currentSidegame?.matches?.length > 0) ? (
                      <>
                        <div className="matches-header">
                          <div className="match-label">Match</div>
                          {holesPlayed.map(hole => (
                            <div key={hole} className="hole-number">{hole}</div>
                          ))}
                          <div className="total-label">Total</div>
                        </div>

                        {/* Generate all possible matches within this group */}
                        {group.map((player1, i) =>
                          group.slice(i + 1).map((player2) => {
                            // Helper function to find player in match results with fuzzy matching
                            const findPlayerInMatch = (match: any, playerName: string) => {
                              // First try exact match
                              if (match.holeResults[playerName] !== undefined) {
                                return { name: playerName, score: match.holeResults[playerName] };
                              }

                              // Try fuzzy matching - look for player names that contain or are contained in the search name
                              const matchedPlayer = Object.keys(match.holeResults).find(name =>
                                name.toLowerCase().includes(playerName.toLowerCase()) ||
                                playerName.toLowerCase().includes(name.toLowerCase())
                              );

                              if (matchedPlayer) {
                                return { name: matchedPlayer, score: match.holeResults[matchedPlayer] };
                              }

                              return null;
                            };

                            // Calculate match results between player1 and player2
                            const player1Wins = holesPlayed.reduce((wins, hole) => {
                              const match = currentSidegame.matches.find(m => m.hole === hole);
                              if (match) {
                                const p1Data = findPlayerInMatch(match, player1);
                                const p2Data = findPlayerInMatch(match, player2);

                                if (p1Data && p2Data) {
                                  // For all-vs-all, we're comparing Stableford points (higher is better)
                                  return wins + (p1Data.score > p2Data.score ? 1 : 0);
                                }
                              }
                              return wins;
                            }, 0);

                            const player2Wins = holesPlayed.reduce((wins, hole) => {
                              const match = currentSidegame.matches.find(m => m.hole === hole);
                              if (match) {
                                const p1Data = findPlayerInMatch(match, player1);
                                const p2Data = findPlayerInMatch(match, player2);

                                if (p1Data && p2Data) {
                                  // For all-vs-all, we're comparing Stableford points (higher is better)
                                  return wins + (p2Data.score > p1Data.score ? 1 : 0);
                                }
                              }
                              return wins;
                            }, 0);

                            const matchResult = player1Wins - player2Wins;

                            return (
                              <div key={`${player1}-${player2}`} className="match-row">
                                <div className="match-players">
                                  {player1.split(' ')[0]} vs {player2.split(' ')[0]}
                                </div>

                                {holesPlayed.map(hole => {
                                  const match = currentSidegame.matches.find(m => m.hole === hole);
                                  let holeResult = '-';

                                  if (match) {
                                    const p1Data = findPlayerInMatch(match, player1);
                                    const p2Data = findPlayerInMatch(match, player2);

                                    if (p1Data && p2Data) {
                                      // For all-vs-all, we're comparing Stableford points (higher is better)
                                      if (p1Data.score > p2Data.score) holeResult = '+1';
                                      else if (p1Data.score < p2Data.score) holeResult = '-1';
                                      else holeResult = 'E';
                                    }
                                  }

                                  return (
                                    <div key={hole} className="match-hole-result">
                                      {holeResult}
                                    </div>
                                  );
                                })}

                                <div className="match-total">
                                  <strong>
                                    {matchResult === 0 ? 'E' : matchResult > 0 ? `+${matchResult}` : `${matchResult}`}
                                  </strong>
                                </div>
                              </div>
                            );
                          })
                        ).flat()}
                      </>
                    ) : (
                      <div className="no-matches-message">
                        <p>
                          {currentSidegame?.matches?.length === 0
                            ? "No scores entered yet. Individual match results will appear here once players start recording scores."
                            : `Debug: Found ${currentSidegame?.matches?.length || 0} matches but ${holesPlayed.length} holes played`
                          }
                        </p>
                        <div className="preview-matches">
                          <h5>Matches in this group:</h5>
                          {group.map((player1, i) =>
                            group.slice(i + 1).map((player2) => (
                              <div key={`${player1}-${player2}`} className="preview-match">
                                {player1.split(' ')[0]} vs {player2.split(' ')[0]}
                              </div>
                            ))
                          ).flat()}
                        </div>
                        {currentSidegame?.matches?.length > 0 && (
                          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f0f0', fontSize: '0.875rem' }}>
                            <strong>Debug Info:</strong>
                            <br />Matches found: {currentSidegame.matches.length}
                            <br />Holes played: {holesPlayed.join(', ') || 'none'}
                            <br />First match: {currentSidegame.matches[0] ? `Hole ${currentSidegame.matches[0].hole}` : 'none'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="all-vs-all-legend">
            <p><strong>All vs All:</strong> Players compete head-to-head within groups</p>
            <p><strong>Scoring:</strong> Win a hole = +1 point for team, Lose = -1 point, Tie = Even</p>
            <p><strong>Match Total:</strong> Net wins/losses across all holes played</p>
          </div>
        </div>
      )}
    </div>
  );
};