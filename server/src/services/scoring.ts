import { Tournament, Player, ScoreEntry, ScoringUpdate, LeaderboardEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export class ScoringService {
  private tournaments: Map<string, Tournament> = new Map();
  private standardPar = [4,4,5,3,5,4,4,4,3,4,5,3,4,4,5,4,3,4];
  private standardIndex = [8,14,4,16,2,6,12,10,18,11,3,17,13,9,1,5,15,7];
  private dataPath: string;
  private saveInProgress = false;

  constructor() {
    // Create data directory if it doesn't exist
    this.dataPath = path.join(process.cwd(), 'tournament-data');
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  createTournament(name: string, course: string, playerNames: string[], totalRounds: number = 1): Tournament {
    // Parse course rating and slope from course string (e.g., "El Saler 74.3 138")
    const courseMatch = course.match(/^(.+?)\s+([\d.]+)\s+([\d.]+)$/);
    const courseName = courseMatch ? courseMatch[1] : course;
    const courseRating = courseMatch ? parseFloat(courseMatch[2]) : 72.0;
    const slopeRating = courseMatch ? parseFloat(courseMatch[3]) : 113;

    const tournament: Tournament = {
      id: uuidv4(),
      name,
      course: courseName,
      courseRating,
      slopeRating,
      par: this.standardPar,
      players: playerNames.map(name => this.parsePlayerInfo(name, courseRating, slopeRating)),
      scores: [],
      createdAt: new Date().toISOString(),
      totalRounds,
      currentRound: 1,
    };

    this.tournaments.set(tournament.id, tournament);
    this.autoSave();
    return tournament;
  }

  private parsePlayerInfo(playerString: string, courseRating: number, slopeRating: number): Player {
    // Parse player name and handicap (e.g., "Christer Smedshammar 4.9")
    const match = playerString.match(/^(.+?)\s+([\d.]+)$/);
    const name = match ? match[1] : playerString;
    const handicap = match ? parseFloat(match[2]) : 0;

    // Calculate course handicap: (Handicap Index × Slope Rating ÷ 113) + (Course Rating - Par)
    const totalPar = this.standardPar.reduce((sum, par) => sum + par, 0);
    const courseHandicap = Math.round((handicap * slopeRating / 113) + (courseRating - totalPar));
    const receivedStrokes = Math.max(0, courseHandicap); // Cannot receive negative strokes

    return {
      id: uuidv4(),
      name,
      currentHole: 1,
      handicap,
      receivedStrokes,
    };
  }

  getTournament(id: string): Tournament | undefined {
    return this.tournaments.get(id);
  }

  setCurrentRound(tournamentId: string, round: number): boolean {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament || round < 1 || round > tournament.totalRounds) {
      return false;
    }
    tournament.currentRound = round;
    this.autoSave();
    return true;
  }

  advanceToNextRound(tournamentId: string): boolean {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament || tournament.currentRound >= tournament.totalRounds) {
      return false;
    }
    tournament.currentRound++;
    this.autoSave();
    return true;
  }

  processScoringUpdate(tournamentId: string, update: ScoringUpdate): ScoreEntry | null {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return null;

    // Handle deletion requests
    if (update.action === 'delete') {
      return this.deleteScore(tournamentId, update);
    }

    let player = tournament.players.find(p =>
      p.name.toLowerCase().includes(update.player.toLowerCase()) ||
      update.player.toLowerCase().includes(p.name.toLowerCase())
    );

    if (!player && update.player) {
      player = {
        id: uuidv4(),
        name: update.player,
        currentHole: 1,
      };
      tournament.players.push(player);
    }

    if (!player) return null;

    const hole = update.hole || player.currentHole;
    const par = tournament.par[hole - 1];
    let strokes = update.strokes;

    if (!strokes) {
      switch (update.action) {
        case 'eagle':
          strokes = par - 2;
          break;
        case 'birdie':
          strokes = par - 1;
          break;
        case 'par':
          strokes = par;
          break;
        case 'bogey':
          strokes = par + 1;
          break;
        case 'double_bogey':
          strokes = par + 2;
          break;
        default:
          return null;
      }
    }

    const scoreEntry: ScoreEntry = {
      playerId: player.id,
      hole,
      round: tournament.currentRound,
      strokes,
      par,
      timestamp: new Date().toISOString(),
    };

    const existingScoreIndex = tournament.scores.findIndex(
      s => s.playerId === player.id && s.hole === hole && s.round === tournament.currentRound
    );

    if (existingScoreIndex >= 0) {
      tournament.scores[existingScoreIndex] = scoreEntry;
    } else {
      tournament.scores.push(scoreEntry);
    }

    if (hole === player.currentHole && hole < 18) {
      player.currentHole = hole + 1;
    }

    this.autoSave();
    return scoreEntry;
  }

  private deleteScore(tournamentId: string, update: ScoringUpdate): ScoreEntry | null {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return null;

    let player: Player | undefined;
    let hole: number | undefined;

    // Find player if specified
    if (update.player) {
      player = tournament.players.find(p =>
        p.name.toLowerCase().includes(update.player.toLowerCase()) ||
        update.player.toLowerCase().includes(p.name.toLowerCase())
      );
    }

    // Use specified hole or try to find the most recent score
    if (update.hole) {
      hole = update.hole;
    } else if (player) {
      // Find the most recent score for this player
      const playerScores = tournament.scores
        .filter(s => s.playerId === player!.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (playerScores.length > 0) {
        hole = playerScores[0].hole;
      }
    } else {
      // Find the most recent score overall
      const allScores = tournament.scores
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (allScores.length > 0) {
        hole = allScores[0].hole;
        player = tournament.players.find(p => p.id === allScores[0].playerId);
      }
    }

    if (!player || !hole) {
      console.log('Could not determine which score to delete');
      return null;
    }

    // Find and remove the score
    const scoreIndex = tournament.scores.findIndex(
      s => s.playerId === player!.id && s.hole === hole
    );

    if (scoreIndex >= 0) {
      const deletedScore = tournament.scores[scoreIndex];
      tournament.scores.splice(scoreIndex, 1);

      console.log(`Deleted score: ${player.name} hole ${hole} (${deletedScore.strokes} strokes)`);

      this.autoSave();

      // Return a "deleted" score entry for tracking
      return {
        playerId: player.id,
        hole,
        round: deletedScore.round,
        strokes: 0, // Indicate deletion
        par: deletedScore.par,
        timestamp: new Date().toISOString(),
      };
    }

    console.log(`No score found to delete for ${player.name} on hole ${hole}`);
    return null;
  }

  generateLeaderboard(tournamentId: string, selectedRound?: number): LeaderboardEntry[] {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return [];

    const leaderboard: LeaderboardEntry[] = tournament.players.map(player => {
      // For the "Round" column, always use current round scores
      const displayRound = selectedRound || tournament.currentRound;
      const currentRoundScores = tournament.scores.filter(s => s.playerId === player.id && s.round === displayRound);

      let totalStrokes = currentRoundScores.reduce((sum, score) => sum + score.strokes, 0);
      let holesCompleted = currentRoundScores.length;
      let totalPar = currentRoundScores.reduce((sum, score) => sum + score.par, 0);
      let totalStablefordPoints = 0;

      const currentScore = totalStrokes - totalPar;

      // Create hole-by-hole scorecard for the display round
      const holeScores: number[] = new Array(18).fill(null);
      const holePars: number[] = tournament.par;
      const stablefordPoints: number[] = new Array(18).fill(null);

      currentRoundScores.forEach(score => {
        holeScores[score.hole - 1] = score.strokes;
        stablefordPoints[score.hole - 1] = this.calculateStablefordPoints(
          score.strokes,
          score.par,
          player.receivedStrokes || 0,
          score.hole
        );
      });

      // Calculate stableford totals for the current round
      totalStablefordPoints = stablefordPoints.reduce((sum, points) => sum + (points || 0), 0);

      const averageStablefordPoints = holesCompleted > 0 ? totalStablefordPoints / holesCompleted : 0;
      const expectedPoints = holesCompleted * 2; // 2 points per hole is par performance
      const stablefordVsPar = totalStablefordPoints - expectedPoints;

      // Generate round-by-round data for multi-round tournaments
      const multiRoundScores = [];
      if (tournament.totalRounds > 1) {
        for (let round = 1; round <= tournament.totalRounds; round++) {
          const roundPlayerScores = tournament.scores.filter(s => s.playerId === player.id && s.round === round);
          const roundHoleScores: (number | null)[] = new Array(18).fill(null);
          const roundStablefordPoints: (number | null)[] = new Array(18).fill(null);
          let roundStrokes = 0;
          let roundStablefordTotal = 0;

          roundPlayerScores.forEach(score => {
            roundHoleScores[score.hole - 1] = score.strokes;
            const stablefordPts = this.calculateStablefordPoints(
              score.strokes,
              score.par,
              player.receivedStrokes || 0,
              score.hole
            );
            roundStablefordPoints[score.hole - 1] = stablefordPts;
            roundStrokes += score.strokes;
            roundStablefordTotal += stablefordPts;
          });

          multiRoundScores.push({
            round,
            holeScores: roundHoleScores,
            stablefordPoints: roundStablefordPoints,
            roundStrokes,
            roundStablefordPoints: roundStablefordTotal,
          });
        }
      }

      return {
        playerId: player.id,
        playerName: player.name,
        totalStrokes,
        holesCompleted,
        currentScore,
        position: 0,
        holeScores,
        holePars,
        stablefordPoints,
        totalStablefordPoints,
        averageStablefordPoints,
        stablefordVsPar,
        handicap: player.handicap,
        receivedStrokes: player.receivedStrokes,
        roundScores: tournament.totalRounds > 1 ? multiRoundScores : undefined,
        totalRounds: tournament.totalRounds,
      };
    });

    leaderboard.sort((a, b) => {
      // Primary sort: Total score vs par (lower is better)
      if (a.currentScore !== b.currentScore) {
        return a.currentScore - b.currentScore;
      }
      // Secondary sort: More holes completed is better (as tiebreaker)
      return b.holesCompleted - a.holesCompleted;
    });

    leaderboard.forEach((entry, index) => {
      entry.position = index + 1;
    });

    return leaderboard;
  }

  getPlayerScorecard(tournamentId: string, playerId: string, round?: number) {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return null;

    const player = tournament.players.find(p => p.id === playerId);
    if (!player) return null;

    // Filter by current round if no specific round is provided
    const targetRound = round !== undefined ? round : tournament.currentRound;
    const scores = tournament.scores
      .filter(s => s.playerId === playerId && s.round === targetRound)
      .sort((a, b) => a.hole - b.hole);

    return {
      player,
      scores,
      par: tournament.par,
    };
  }

  calculateStablefordPoints(strokes: number, par: number, receivedStrokes: number, hole: number): number {
    // Determine if player gets a stroke on this hole based on handicap index
    const holeIndex = this.standardIndex[hole - 1];
    const strokesReceived = Math.floor(receivedStrokes / 18) + (holeIndex <= (receivedStrokes % 18) ? 1 : 0);

    // Adjusted par for this player on this hole
    const adjustedPar = par + strokesReceived;

    // Calculate stableford points based on score vs adjusted par
    const scoreDiff = strokes - adjustedPar;

    if (scoreDiff <= -2) return 4; // Eagle or better (2+ under adjusted par)
    if (scoreDiff === -1) return 3; // Birdie (1 under adjusted par)
    if (scoreDiff === 0) return 2;  // Par (equal to adjusted par)
    if (scoreDiff === 1) return 1;  // Bogey (1 over adjusted par)
    return 0; // Double bogey or worse (2+ over adjusted par)
  }

  // Persistence methods
  private saveTournaments(): void {
    // Skip if save already in progress
    if (this.saveInProgress) {
      console.log('Save already in progress, skipping...');
      return;
    }

    this.saveInProgress = true;
    try {
      const tournamentsObject = Object.fromEntries(this.tournaments);
      const dataFile = path.join(this.dataPath, 'tournaments.json');
      const tempFile = dataFile + '.tmp';

      // Write to temporary file first, then atomically rename
      fs.writeFileSync(tempFile, JSON.stringify(tournamentsObject, null, 2));
      fs.renameSync(tempFile, dataFile);

      console.log('Tournament data saved successfully');
    } catch (error) {
      console.error('Failed to save tournament data:', error);
      // Clean up temp file if it exists
      const tempFile = path.join(this.dataPath, 'tournaments.json.tmp');
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } finally {
      this.saveInProgress = false;
    }
  }

  loadTournaments(): void {
    try {
      const dataFile = path.join(this.dataPath, 'tournaments.json');
      if (fs.existsSync(dataFile)) {
        const data = fs.readFileSync(dataFile, 'utf8');
        const tournamentsObject = JSON.parse(data);
        this.tournaments = new Map(Object.entries(tournamentsObject));
        console.log(`Loaded ${this.tournaments.size} tournaments from storage`);
      } else {
        console.log('No existing tournament data found');
      }
    } catch (error) {
      console.error('Failed to load tournament data:', error);
    }
  }

  // Auto-save after data changes
  private autoSave(): void {
    this.saveTournaments();
  }

  // Clear all tournament data (scores, reset round to 1)
  clearTournamentData(tournamentId: string): boolean {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return false;

    // Clear all scores
    tournament.scores = [];

    // Reset current round to 1
    tournament.currentRound = 1;

    // Reset all players' current hole to 1
    tournament.players.forEach(player => {
      player.currentHole = 1;
    });

    this.autoSave();
    console.log(`Cleared all data for tournament: ${tournament.name}`);
    return true;
  }
}
