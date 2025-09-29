import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root - works for both dev and production
const envPath = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '../../../../.env')  // For compiled code in dist/server/src/
  : path.resolve(__dirname, '../../.env');       // For development tsx watch in server/src/
dotenv.config({ path: envPath });
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import { TranscriptionService } from './services/transcription';
import { ScoringService } from './services/scoring';
import { TeamSidegameService } from './services/teamSidegame';
import type { WebSocketMessage, ScoreEntry } from '../../shared/types';

const app = express();
const server = createServer(app);
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://your-app-name.vercel.app'] // You'll update this with actual Vercel URL
  : ['http://localhost:5173', 'http://localhost:3000'];

const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const transcriptionService = new TranscriptionService();
const scoringService = new ScoringService();
const teamSidegameService = new TeamSidegameService();

// Load existing tournaments and sidegames from storage
scoringService.loadTournaments();
teamSidegameService.loadSidegames();

// Create or get active tournament
let activeTournament = Array.from(scoringService['tournaments'].values()).find(t => t.name === 'GA 2025');

if (!activeTournament) {
  activeTournament = scoringService.createTournament(
    'GA 2025',
    'El Saler 72.7 133',
    ['Christer Smedshammar 4.9','Erik Qvist 8.7','Anders Sandgren 6.5','Andreas Jörbeck 25.0','Fredrik Edwall 11.3','Johan Kökeritz 18.4','Daniel Jönsson 11.4','Stefan Lindblad 23.0','Henrik Jarpner 7.7','Kristian Anselius 7.3'],
    10 // 10-round tournament
  );
  console.log('Created new tournament:', activeTournament.name);
} else {
  console.log('Using existing tournament:', activeTournament.name);
}

app.post('/api/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const playerNames = activeTournament.players.map(p => p.name);
    const transcription = await transcriptionService.transcribeAudio(req.file.buffer, playerNames);
    console.log('Transcription:', transcription);

    io.emit('message', {
      type: 'transcription',
      data: { text: transcription },
      timestamp: Date.now()
    } as WebSocketMessage);

    const scoringUpdates = await transcriptionService.parseTranscriptionToScore(transcription, playerNames);

    // Send parsed scoring data for score verification
    if (scoringUpdates.length > 0) {
      io.emit('message', {
        type: 'score_verification_data',
        data: {
          scoringUpdates: scoringUpdates.map(update => ({
            playerId: activeTournament.players.find(p => p.name === update.player)?.id,
            playerName: update.player,
            hole: update.hole,
            strokes: update.strokes
          })).filter(u => u.playerId) // Only include players found in tournament
        },
        timestamp: Date.now()
      } as WebSocketMessage);
    }
    console.log('Parsed scoring updates:', scoringUpdates);

    const scoreEntries: ScoreEntry[] = [];
    let leaderboardChanged = false;

    // Handle empty updates (e.g., non-scoring transcriptions)
    if (scoringUpdates.length === 0) {
      console.log('No scoring updates found in transcription');
    } else {
      // Process each scoring update
      for (const scoringUpdate of scoringUpdates) {
        const scoreEntry = scoringService.processScoringUpdate(activeTournament.id, scoringUpdate);
        if (scoreEntry) {
          scoreEntries.push(scoreEntry);
          leaderboardChanged = true;

          const updateType = scoringUpdate.action === 'delete' ? 'score_deletion' : 'scoring_update';

          // Emit individual scoring update
          io.emit('message', {
            type: updateType as any,
            data: { scoreEntry, update: scoringUpdate },
            timestamp: Date.now()
          } as WebSocketMessage);
        }
      }
    }

    // Emit leaderboard update once after processing all scores
    if (leaderboardChanged) {
      const leaderboard = scoringService.generateLeaderboard(activeTournament.id);
      io.emit('message', {
        type: 'leaderboard_update',
        data: { leaderboard },
        timestamp: Date.now()
      } as WebSocketMessage);

      // Process team sidegame matches if any exist
      const currentSidegame = teamSidegameService.getSidegameByRound(activeTournament.id, activeTournament.currentRound);
      if (currentSidegame && scoreEntries.length > 0) {
        console.log(`DEBUG: Audio processing ${scoreEntries.length} score entries for ${currentSidegame.gameType}`);

        // Get holes affected by the new score entries
        const affectedHoles = [...new Set(scoreEntries.map(se => se.hole))];

        affectedHoles.forEach(hole => {
          console.log(`DEBUG: Processing hole ${hole} for audio entries`);

          if (currentSidegame.gameType === 'all-vs-all') {
            // For all-vs-all, collect ALL scores for this hole (not just from current audio)
            const allHoleScores = activeTournament.scores.filter(s =>
              s.hole === hole && s.round === activeTournament.currentRound
            );

            console.log(`DEBUG: Found ${allHoleScores.length} total scores for hole ${hole} in all-vs-all (audio)`);

            if (allHoleScores.length > 1) { // Only process if we have multiple scores
              const holeResults: { [playerName: string]: number } = {};

              allHoleScores.forEach(score => {
                const player = activeTournament.players.find(p => p.id === score.playerId);
                if (player) {
                  const stablefordPoints = scoringService.calculateStablefordPoints(
                    score.strokes,
                    score.par,
                    player.receivedStrokes || 0,
                    score.hole
                  );
                  holeResults[player.name] = stablefordPoints;
                  console.log(`DEBUG: Player ${player.name} has ${stablefordPoints} Stableford points on hole ${score.hole} (audio)`);
                }
              });

              console.log(`DEBUG: Processing all-vs-all match (audio) with ${Object.keys(holeResults).length} players:`, Object.keys(holeResults));

              const teamMatch = teamSidegameService.processHoleMatch(currentSidegame.id, hole, holeResults);
              if (teamMatch) {
                console.log(`DEBUG: Created team match for hole ${hole} (audio):`, teamMatch);

                // Emit team match update
                io.emit('message', {
                  type: 'team_match_update',
                  data: { teamMatch, sidegameId: currentSidegame.id },
                  timestamp: Date.now()
                } as WebSocketMessage);

                // Emit updated team leaderboard
                const teamLeaderboard = teamSidegameService.generateTeamLeaderboard(currentSidegame.id);
                io.emit('message', {
                  type: 'team_leaderboard_update',
                  data: { leaderboard: teamLeaderboard, sidegameId: currentSidegame.id },
                  timestamp: Date.now()
                } as WebSocketMessage);
              } else {
                console.log(`DEBUG: No team match created for hole ${hole} (audio)`);
              }
            } else {
              console.log(`DEBUG: Not enough scores (${allHoleScores.length}) for all-vs-all match on hole ${hole} (audio)`);
            }
          } else {
            // For sum-match, process just the scores from this audio transcription
            const holeResults: { [playerName: string]: number } = {};

            scoreEntries.filter(se => se.hole === hole).forEach(scoreEntry => {
              const player = activeTournament.players.find(p => p.id === scoreEntry.playerId);
              if (player) {
                const holeValue = scoreEntry.strokes - scoreEntry.par;
                holeResults[player.name] = holeValue;
                console.log(`DEBUG: Processing sum-match (audio) for player ${player.name}, hole ${hole}, value ${holeValue}`);
              }
            });

            if (Object.keys(holeResults).length > 0) {
              const teamMatch = teamSidegameService.processHoleMatch(currentSidegame.id, hole, holeResults);
              if (teamMatch) {
                console.log(`DEBUG: Created team match for sum-match hole ${hole} (audio)`);

                // Emit team match update
                io.emit('message', {
                  type: 'team_match_update',
                  data: { teamMatch, sidegameId: currentSidegame.id },
                  timestamp: Date.now()
                } as WebSocketMessage);

                // Emit updated team leaderboard
                const teamLeaderboard = teamSidegameService.generateTeamLeaderboard(currentSidegame.id);
                io.emit('message', {
                  type: 'team_leaderboard_update',
                  data: { leaderboard: teamLeaderboard, sidegameId: currentSidegame.id },
                  timestamp: Date.now()
                } as WebSocketMessage);
              }
            }
          }
        });
      }
    }

    res.json({
      transcription,
      scoringUpdates,
      scoreEntries,
      totalUpdates: scoringUpdates.length
    });
  } catch (error) {
    console.error('Audio processing error:', error);
    res.status(500).json({ error: 'Failed to process audio' });
  }
});

app.get('/api/tournament/:id', (req, res) => {
  const tournament = scoringService.getTournament(req.params.id);
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  res.json(tournament);
});

app.get('/api/tournament/:id/leaderboard', (req, res) => {
  const round = req.query.round ? parseInt(req.query.round as string) : undefined;
  const leaderboard = scoringService.generateLeaderboard(req.params.id, round);
  res.json(leaderboard);
});

app.get('/api/tournament/:id/player/:playerId/scorecard', (req, res) => {
  const scorecard = scoringService.getPlayerScorecard(req.params.id, req.params.playerId);
  if (!scorecard) {
    return res.status(404).json({ error: 'Player or tournament not found' });
  }
  res.json(scorecard);
});

app.get('/api/active-tournament', (req, res) => {
  res.json(activeTournament);
});

app.post('/api/tournament/:id/round/:round', (req, res) => {
  const success = scoringService.setCurrentRound(req.params.id, parseInt(req.params.round));
  if (!success) {
    return res.status(400).json({ error: 'Invalid round or tournament' });
  }
  res.json({ success: true, currentRound: parseInt(req.params.round) });
});

app.post('/api/tournament/:id/advance-round', (req, res) => {
  const success = scoringService.advanceToNextRound(req.params.id);
  if (!success) {
    return res.status(400).json({ error: 'Cannot advance round' });
  }
  const tournament = scoringService.getTournament(req.params.id);
  res.json({ success: true, currentRound: tournament?.currentRound });
});

// Team sidegame endpoints
app.get('/api/teams', (req, res) => {
  const teams = teamSidegameService.getTeams();
  res.json(teams);
});

app.post('/api/tournament/:id/round/:round/sidegame', (req, res) => {
  const { gameType, groupings } = req.body;

  if (!gameType || !['all-vs-all', 'sum-match'].includes(gameType)) {
    return res.status(400).json({ error: 'Invalid game type' });
  }

  const sidegame = teamSidegameService.createSidegame(
    req.params.id,
    parseInt(req.params.round),
    gameType,
    groupings
  );

  res.json(sidegame);
});

app.get('/api/tournament/:id/round/:round/sidegame', (req, res) => {
  const sidegame = teamSidegameService.getSidegameByRound(
    req.params.id,
    parseInt(req.params.round)
  );

  if (!sidegame) {
    return res.status(404).json({ error: 'No sidegame found for this round' });
  }

  res.json(sidegame);
});

app.get('/api/sidegame/:id/leaderboard', (req, res) => {
  const leaderboard = teamSidegameService.generateTeamLeaderboard(req.params.id);
  res.json(leaderboard);
});

app.get('/api/sidegame/:id/sum-match/scorecard', (req, res) => {
  const scorecard = teamSidegameService.getSumMatchLiveScorecard(req.params.id);
  res.json(scorecard);
});

// Clear tournament data endpoint
app.post('/api/tournament/:id/clear', (req, res) => {
  try {
    const tournamentId = req.params.id;

    // Clear tournament data in scoring service
    const success = scoringService.clearTournamentData(tournamentId);
    if (!success) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Clear team sidegames for this tournament
    teamSidegameService.clearTournamentSidegames(tournamentId);

    // Emit leaderboard update with empty data
    io.emit('message', {
      type: 'leaderboard_update',
      data: { leaderboard: [] },
      timestamp: Date.now()
    });

    // Emit team leaderboard update with empty data
    io.emit('message', {
      type: 'team_leaderboard_update',
      data: { leaderboard: [], sidegameId: null },
      timestamp: Date.now()
    });

    res.json({ success: true, message: 'Tournament data cleared successfully' });
  } catch (error) {
    console.error('Clear tournament error:', error);
    res.status(500).json({ error: 'Failed to clear tournament data' });
  }
});

// Manual score update endpoint
app.post('/api/tournament/:id/manual-score', (req, res) => {
  try {
    const { playerId, hole, strokes } = req.body;

    if (!playerId || !hole || strokes === undefined) {
      return res.status(400).json({ error: 'Missing required fields: playerId, hole, strokes' });
    }

    const player = activeTournament.players.find(p => p.id === playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Create a scoring update similar to voice input
    const scoringUpdate = {
      player: player.name,
      hole: parseInt(hole),
      strokes: strokes === null ? null : parseInt(strokes),
      action: (strokes === null ? 'delete' : 'score') as 'delete' | 'score',
      rawTranscription: `Manual entry: ${player.name} hole ${hole} ${strokes === null ? 'deleted' : strokes + ' strokes'}`
    };

    const scoreEntry = scoringService.processScoringUpdate(activeTournament.id, scoringUpdate);
    if (!scoreEntry) {
      return res.status(400).json({ error: 'Failed to process score update' });
    }

    // Emit updates to all clients
    const updateType = scoringUpdate.action === 'delete' ? 'score_deletion' : 'scoring_update';
    io.emit('message', {
      type: updateType as any,
      data: { scoreEntry, update: scoringUpdate },
      timestamp: Date.now()
    });

    // Emit leaderboard update
    const leaderboard = scoringService.generateLeaderboard(activeTournament.id);
    io.emit('message', {
      type: 'leaderboard_update',
      data: { leaderboard },
      timestamp: Date.now()
    });

    // Process team sidegame matches if any exist
    const currentSidegame = teamSidegameService.getSidegameByRound(activeTournament.id, activeTournament.currentRound);
    if (currentSidegame && scoreEntry) {
      console.log(`DEBUG: Processing team sidegame for ${currentSidegame.gameType}, hole ${scoreEntry.hole}, player ${player.name}`);

      // For all-vs-all matches, we need to collect all scores for this hole from all players
      // For sum-match, we can process individual scores as they come in

      if (currentSidegame.gameType === 'all-vs-all') {
        // For all-vs-all, collect all players' scores for this hole
        const holeScores = activeTournament.scores.filter(s =>
          s.hole === scoreEntry.hole && s.round === activeTournament.currentRound
        );

        console.log(`DEBUG: Found ${holeScores.length} scores for hole ${scoreEntry.hole} in all-vs-all`);

        if (holeScores.length > 1) { // Only process if we have multiple scores
          const holeResults: { [playerName: string]: number } = {};

          holeScores.forEach(score => {
            const scorePlayer = activeTournament.players.find(p => p.id === score.playerId);
            if (scorePlayer) {
              const stablefordPoints = scoringService.calculateStablefordPoints(
                score.strokes,
                score.par,
                scorePlayer.receivedStrokes || 0,
                score.hole
              );
              holeResults[scorePlayer.name] = stablefordPoints;
              console.log(`DEBUG: Player ${scorePlayer.name} has ${stablefordPoints} Stableford points on hole ${score.hole}`);
            }
          });

          console.log(`DEBUG: Processing all-vs-all match with ${Object.keys(holeResults).length} players:`, Object.keys(holeResults));

          const teamMatch = teamSidegameService.processHoleMatch(currentSidegame.id, scoreEntry.hole, holeResults);
          if (teamMatch) {
            console.log(`DEBUG: Created team match for hole ${scoreEntry.hole}:`, teamMatch);

            // Emit team match update
            io.emit('message', {
              type: 'team_match_update',
              data: { teamMatch, sidegameId: currentSidegame.id },
              timestamp: Date.now()
            });

            // Emit updated team leaderboard
            const teamLeaderboard = teamSidegameService.generateTeamLeaderboard(currentSidegame.id);
            io.emit('message', {
              type: 'team_leaderboard_update',
              data: { leaderboard: teamLeaderboard, sidegameId: currentSidegame.id },
              timestamp: Date.now()
            });
          } else {
            console.log(`DEBUG: No team match created for hole ${scoreEntry.hole}`);
          }
        } else {
          console.log(`DEBUG: Not enough scores (${holeScores.length}) for all-vs-all match on hole ${scoreEntry.hole}`);
        }
      } else {
        // For sum-match, use strokes vs par (lower is better) - process individual scores
        const holeValue = scoreEntry.strokes - scoreEntry.par;
        const holeResults: { [playerName: string]: number } = {
          [player.name]: holeValue
        };

        console.log(`DEBUG: Processing sum-match for player ${player.name}, hole ${scoreEntry.hole}, value ${holeValue}`);

        const teamMatch = teamSidegameService.processHoleMatch(currentSidegame.id, scoreEntry.hole, holeResults);
        if (teamMatch) {
          console.log(`DEBUG: Created team match for sum-match hole ${scoreEntry.hole}`);

          // Emit team match update
          io.emit('message', {
            type: 'team_match_update',
            data: { teamMatch, sidegameId: currentSidegame.id },
            timestamp: Date.now()
          });

          // Emit updated team leaderboard
          const teamLeaderboard = teamSidegameService.generateTeamLeaderboard(currentSidegame.id);
          io.emit('message', {
            type: 'team_leaderboard_update',
            data: { leaderboard: teamLeaderboard, sidegameId: currentSidegame.id },
            timestamp: Date.now()
          });
        }
      }
    }

    res.json({
      success: true,
      scoreEntry,
      scoringUpdate
    });
  } catch (error) {
    console.error('Manual score update error:', error);
    res.status(500).json({ error: 'Failed to update score' });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.emit('message', {
    type: 'leaderboard_update',
    data: { leaderboard: scoringService.generateLeaderboard(activeTournament.id) },
    timestamp: Date.now()
  } as WebSocketMessage);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, server, io };
