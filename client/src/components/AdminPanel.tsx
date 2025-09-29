import React, { useState, useEffect } from 'react';
import { RoundSelector } from './RoundSelector';
import { TeamSidegameAdmin } from './TeamSidegameAdmin';
import { apiService } from '../services/api';
import type { Tournament } from '../types';

interface AdminPanelProps {
  onBackToMain: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToMain }) => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState('');

  useEffect(() => {
    loadTournamentData();
  }, []);

  const loadTournamentData = async () => {
    try {
      setLoading(true);
      const activeTournament = await apiService.getActiveTournament();
      setTournament(activeTournament);
    } catch (err) {
      console.error('Failed to load tournament data:', err);
      setError('Failed to load tournament data');
    } finally {
      setLoading(false);
    }
  };

  const handleRoundSelect = (round: number | null) => {
    setSelectedRound(round);
  };

  const handleAdvanceRound = async () => {
    if (!tournament) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/tournament/${tournament.id}/advance-round`, {
        method: 'POST',
      });

      if (response.ok) {
        await loadTournamentData();
        setError(null);
      } else {
        throw new Error('Failed to advance round');
      }
    } catch (err) {
      console.error('Failed to advance round:', err);
      setError('Failed to advance round');
    } finally {
      setLoading(false);
    }
  };

  const handleClearTournament = async () => {
    if (!tournament || clearConfirmationText !== 'CLEAR ALL DATA') {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/tournament/${tournament.id}/clear`, {
        method: 'POST',
      });

      if (response.ok) {
        await loadTournamentData();
        setError(null);
        setShowClearConfirmation(false);
        setClearConfirmationText('');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear tournament data');
      }
    } catch (err) {
      console.error('Failed to clear tournament:', err);
      setError(`Failed to clear tournament: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClear = () => {
    setShowClearConfirmation(false);
    setClearConfirmationText('');
  };


  if (loading) {
    return (
      <div className="admin-panel">
        <div className="admin-header">
          <h1>Tournament Administration</h1>
          <button className="back-btn" onClick={onBackToMain}>
            ← Back to Main
          </button>
        </div>
        <div className="loading">Loading tournament data...</div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Tournament Administration</h1>
        <button className="back-btn" onClick={onBackToMain}>
          ← Back to Main
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      {tournament && (
        <div className="admin-content">
          <div className="tournament-details">
            <h2>{tournament.name}</h2>
            <p>{tournament.course}</p>
            <p>Players: {tournament.players.length}</p>
            <p>Current Round: {tournament.currentRound} of {tournament.totalRounds}</p>
          </div>

          {tournament.totalRounds > 1 && (
            <div className="round-management">
              <RoundSelector
                currentRound={tournament.currentRound}
                totalRounds={tournament.totalRounds}
                selectedRound={selectedRound}
                onRoundSelect={handleRoundSelect}
                onAdvanceRound={handleAdvanceRound}
              />
            </div>
          )}

          <div className="admin-actions">
            <div className="action-section">
              <h3>Round Management</h3>
              <p>Use the round selector above to advance to the next round or view different rounds.</p>
              {tournament.currentRound < tournament.totalRounds && (
                <p className="warning">
                  ⚠️ Advancing to the next round will affect all users and cannot be undone.
                </p>
              )}
            </div>

            <div className="action-section">
              <TeamSidegameAdmin
                tournament={tournament}
                selectedRound={selectedRound}
              />
            </div>

            <div className="action-section danger-section">
              <h3>Danger Zone</h3>
              <p>Clear all tournament data including scores, round progress, and team sidegames.</p>

              {!showClearConfirmation ? (
                <button
                  className="danger-btn"
                  onClick={() => setShowClearConfirmation(true)}
                >
                  Clear Tournament Data
                </button>
              ) : (
                <div className="clear-confirmation">
                  <div className="confirmation-warning">
                    <h4>⚠️ This action cannot be undone!</h4>
                    <p>This will permanently delete:</p>
                    <ul>
                      <li>All player scores from all rounds</li>
                      <li>Round progress (reset to Round 1)</li>
                      <li>All team sidegame data and results</li>
                    </ul>
                    <p>To confirm, type: <strong>CLEAR ALL DATA</strong></p>
                  </div>

                  <input
                    type="text"
                    placeholder="Type: CLEAR ALL DATA"
                    value={clearConfirmationText}
                    onChange={(e) => setClearConfirmationText(e.target.value)}
                    className="confirmation-input"
                  />

                  <div className="confirmation-buttons">
                    <button
                      className="cancel-btn"
                      onClick={handleCancelClear}
                    >
                      Cancel
                    </button>
                    <button
                      className="confirm-danger-btn"
                      onClick={handleClearTournament}
                      disabled={clearConfirmationText !== 'CLEAR ALL DATA'}
                    >
                      Clear All Data
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};