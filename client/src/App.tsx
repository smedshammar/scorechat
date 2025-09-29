import { useState, useEffect, useRef } from 'react';
import { AudioRecorder } from './components/AudioRecorder';
import { Leaderboard } from './components/Leaderboard';
import { TeamLeaderboard } from './components/TeamLeaderboard';
import { ScoreVerificationGrid } from './components/ScoreVerificationGrid';
import { AdminPanel } from './components/AdminPanel';
import { apiService } from './services/api';
import type { LeaderboardEntry, WebSocketMessage, Tournament, ScoreEntry } from './types';
import './App.css';

interface PlayerScore {
  playerId: string;
  playerName: string;
  holeScores: Record<number, number | null>;
}

function App() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerScores, setPlayerScores] = useState<PlayerScore[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'main' | 'admin'>('main');
  const [teamLeaderboardData, setTeamLeaderboardData] = useState<any>(null);
  const tournamentRef = useRef<Tournament | null>(null);

  // Update ref whenever tournament state changes
  useEffect(() => {
    tournamentRef.current = tournament;
  }, [tournament]);

  useEffect(() => {
    const socket = apiService.initializeSocket();

    if (!socket) {
      // Socket.IO disabled in production, use HTTP-only mode
      setConnectionStatus('connected'); // Show as connected since HTTP API is working
      setError(null);
      return;
    }

    socket.on('connect', () => {
      setConnectionStatus('connected');
      setError(null);
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('disconnected');
      setError('Failed to connect to server');
    });

    apiService.onMessage((message: WebSocketMessage) => {
      switch (message.type) {
        case 'transcription':
          // Handle transcription display if needed
          console.log('Transcription received:', message.data.text);
          break;

        case 'score_verification_data':
          // Handle parsed scoring data for verification grid
          if (message.data.scoringUpdates) {
            console.log('Score verification data received:', message.data.scoringUpdates);
            updateScoreVerificationGrid(message.data.scoringUpdates);
          }
          break;

        case 'scoring_update':
          // Score has been processed, could update verification status
          break;

        case 'leaderboard_update':
          setLeaderboard(message.data.leaderboard);
          break;

        case 'team_leaderboard_update':
        case 'team_match_update':
          setTeamLeaderboardData({ type: message.type, data: message.data });
          break;
      }
    });

    const loadInitialData = async () => {
      try {
        const activeTournament = await apiService.getActiveTournament();
        setTournament(activeTournament);

        const initialLeaderboard = await apiService.getLeaderboard(activeTournament.id);
        setLeaderboard(initialLeaderboard);

        // Load existing scores for score verification grid
        const existingPlayerScores: PlayerScore[] = [];
        for (const player of activeTournament.players) {
          const scorecard = await apiService.getPlayerScorecard(activeTournament.id, player.id);
          if (scorecard && scorecard.scores.length > 0) {
            const holeScores: Record<number, number | null> = {};
            scorecard.scores.forEach((score: ScoreEntry) => {
              holeScores[score.hole] = score.strokes;
            });

            existingPlayerScores.push({
              playerId: player.id,
              playerName: player.name,
              holeScores
            });
          }
        }

        if (existingPlayerScores.length > 0) {
          setPlayerScores(existingPlayerScores);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setError('Failed to load tournament data');
      }
    };

    loadInitialData();

    return () => {
      apiService.disconnect();
    };
  }, []); // Remove tournament dependency to prevent reconnection loops

  const updateScoreVerificationGrid = (scoringUpdates: any[]) => {
    console.log('Updating score verification grid with:', scoringUpdates);

    setPlayerScores(prev => {
      const updated = [...prev];

      scoringUpdates.forEach(update => {
        const { playerId, playerName, hole, strokes } = update;

        let playerScore = updated.find(ps => ps.playerId === playerId);

        if (!playerScore) {
          playerScore = {
            playerId,
            playerName,
            holeScores: {} as Record<number, number | null>
          };
          updated.push(playerScore);
        }

        // Set the score for this hole
        playerScore.holeScores[hole] = strokes;
      });

      return updated;
    });
  };

  const handleTranscription = (text: string) => {
    console.log('New transcription:', text);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setTimeout(() => setError(null), 5000);
  };

  const handleRemovePlayer = (playerId: string) => {
    setPlayerScores(prev => prev.filter(ps => ps.playerId !== playerId));
  };

  const handleUpdateScore = async (playerId: string, hole: number, score: number | null) => {
    // Update local state immediately for responsiveness
    setPlayerScores(prev => prev.map(ps =>
      ps.playerId === playerId
        ? {
            ...ps,
            holeScores: {
              ...ps.holeScores,
              [hole]: score
            }
          }
        : ps
    ));

    // Send to server for persistence and leaderboard update
    if (tournament) {
      try {
        const response = await fetch(`/api/tournament/${tournament.id}/manual-score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            playerId,
            hole,
            strokes: score
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to update score on server:', errorData.error);
          // You could show an error toast here
        }
      } catch (error) {
        console.error('Error updating score:', error);
        // You could show an error toast here
      }
    }
  };

  if (view === 'admin') {
    return <AdminPanel onBackToMain={() => setView('main')} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>ScoreChat Golf</h1>
        <div className="header-controls">
          <button
            className="admin-btn"
            onClick={() => setView('admin')}
          >
            Admin
          </button>
          <div className="connection-status">
            <span className={`status-indicator ${connectionStatus}`}></span>
            <span>{connectionStatus}</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      {tournament && (
        <div className="tournament-info">
          <h2>{tournament.name}</h2>
          <p>{tournament.course}</p>
        </div>
      )}

      <main className="app-main">
        <div className="left-panel">
          <div className="audio-section">
            <h2>Voice Input</h2>
            <AudioRecorder
              onTranscription={handleTranscription}
              onError={handleError}
            />
          </div>

          <ScoreVerificationGrid
            playerScores={playerScores}
            onRemovePlayer={handleRemovePlayer}
            onUpdateScore={handleUpdateScore}
          />
        </div>

        <div className="right-panel">
          <Leaderboard leaderboard={leaderboard} />
          {tournament && (
            <TeamLeaderboard
              tournament={tournament}
              currentRound={tournament.currentRound}
              webSocketUpdate={teamLeaderboardData}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;