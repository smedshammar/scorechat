import React, { useState, useEffect } from 'react';
import type { Team, TeamSidegame, Tournament } from '../types';

interface TeamSidegameAdminProps {
  tournament: Tournament;
  selectedRound: number | null;
}

export const TeamSidegameAdmin: React.FC<TeamSidegameAdminProps> = ({
  tournament,
  selectedRound,
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentSidegame, setCurrentSidegame] = useState<TeamSidegame | null>(null);
  const [gameType, setGameType] = useState<'all-vs-all' | 'sum-match'>('sum-match');
  const [groupings, setGroupings] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentRound = selectedRound || tournament.currentRound;

  useEffect(() => {
    loadTeams();
    loadCurrentSidegame();
  }, [tournament.id, currentRound]);

  const loadTeams = async () => {
    try {
      const response = await fetch('/api/teams');
      if (response.ok) {
        const teamsData = await response.json();
        setTeams(teamsData);
      }
    } catch (err) {
      console.error('Failed to load teams:', err);
    }
  };

  const loadCurrentSidegame = async () => {
    try {
      const response = await fetch(`/api/tournament/${tournament.id}/round/${currentRound}/sidegame`);
      if (response.ok) {
        const sidegame = await response.json();
        setCurrentSidegame(sidegame);
        setGameType(sidegame.gameType);
        setGroupings(sidegame.groupings || []);
      } else if (response.status === 404) {
        setCurrentSidegame(null);
      }
    } catch (err) {
      console.error('Failed to load sidegame:', err);
    }
  };

  const createSidegame = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/tournament/${tournament.id}/round/${currentRound}/sidegame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameType,
          groupings: gameType === 'all-vs-all' ? groupings : undefined,
        }),
      });

      if (response.ok) {
        await loadCurrentSidegame();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create sidegame');
      }
    } catch (err) {
      console.error('Failed to create sidegame:', err);
      setError('Failed to create sidegame');
    } finally {
      setLoading(false);
    }
  };

  const addGrouping = () => {
    setGroupings([...groupings, []]);
  };

  const updateGrouping = (index: number, players: string[]) => {
    const newGroupings = [...groupings];
    newGroupings[index] = players;
    setGroupings(newGroupings);
  };

  const removeGrouping = (index: number) => {
    const newGroupings = groupings.filter((_, i) => i !== index);
    setGroupings(newGroupings);
  };

  const availablePlayers = tournament.players.map(p => p.name);

  return (
    <div className="team-sidegame-admin">
      <h3>Team Sidegame - Round {currentRound}</h3>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      {currentSidegame ? (
        <div className="sidegame-info">
          <div className="sidegame-details">
            <p><strong>Game Type:</strong> {currentSidegame.gameType}</p>
            <p><strong>Teams:</strong> {currentSidegame.teams.map(t => t.name).join(', ')}</p>
            <p><strong>Matches Played:</strong> {currentSidegame.matches.length}</p>
          </div>

          {currentSidegame.gameType === 'all-vs-all' && (
            <div className="groupings-display">
              <h4>Groupings:</h4>
              {currentSidegame.groupings?.map((group, index) => (
                <div key={index} className="grouping">
                  <strong>Group {index + 1}:</strong> {group.join(', ')}
                </div>
              ))}
            </div>
          )}

          <div className="sidegame-status">
            <p className="success">✅ Team sidegame is active for this round</p>
          </div>
        </div>
      ) : (
        <div className="sidegame-setup">
          <div className="game-type-selector">
            <h4>Select Game Type:</h4>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="sum-match"
                  checked={gameType === 'sum-match'}
                  onChange={(e) => setGameType(e.target.value as 'sum-match')}
                />
                <span>Sum Match</span>
                <small>Teams compete by sum of strokes vs par per hole (+1/-1 points)</small>
              </label>
              <label>
                <input
                  type="radio"
                  value="all-vs-all"
                  checked={gameType === 'all-vs-all'}
                  onChange={(e) => setGameType(e.target.value as 'all-vs-all')}
                />
                <span>All vs All</span>
                <small>Players compete individually within groups</small>
              </label>
            </div>
          </div>

          {gameType === 'all-vs-all' && (
            <div className="groupings-setup">
              <h4>Setup Groupings:</h4>
              <p className="info">Create groups where each player competes against every other player in the group (except teammates)</p>

              {groupings.map((group, index) => (
                <div key={index} className="grouping-editor">
                  <div className="grouping-header">
                    <h5>Group {index + 1}</h5>
                    <button
                      type="button"
                      onClick={() => removeGrouping(index)}
                      className="remove-btn"
                    >
                      ×
                    </button>
                  </div>
                  <select
                    multiple
                    value={group}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      updateGrouping(index, selected);
                    }}
                    className="player-selector"
                  >
                    {availablePlayers.map(player => (
                      <option key={player} value={player}>
                        {player}
                      </option>
                    ))}
                  </select>
                  <small>Selected: {group.join(', ')}</small>
                </div>
              ))}

              <button
                type="button"
                onClick={addGrouping}
                className="add-grouping-btn"
              >
                + Add Group
              </button>
            </div>
          )}

          {gameType === 'sum-match' && (
            <div className="sum-match-info">
              <h4>Sum Match Rules:</h4>
              <div className="teams-display">
                {teams.map(team => (
                  <div key={team.id} className="team-info">
                    <div
                      className="team-color"
                      style={{ backgroundColor: team.color }}
                    ></div>
                    <div className="team-details">
                      <strong>{team.name}</strong>
                      <div className="team-players">
                        {team.players.join(', ')}
                      </div>
                      {team.id === 'green' && (
                        <small className="team-note">
                          * Alternates: Anders (odd holes), Christer (even holes)
                        </small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="create-sidegame">
            <button
              onClick={createSidegame}
              disabled={loading || (gameType === 'all-vs-all' && groupings.length === 0)}
              className="create-btn"
            >
              {loading ? 'Creating...' : `Create ${gameType === 'sum-match' ? 'Sum Match' : 'All vs All'} Sidegame`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};