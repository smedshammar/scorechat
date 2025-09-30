import { Team, TeamSidegame, TeamMatch, TeamLeaderboardEntry, Tournament } from '../types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export class TeamSidegameService {
  private sidegames: Map<string, TeamSidegame> = new Map();
  private teams: Map<string, Team> = new Map();
  private dataPath: string;
  private saveInProgress = false;

  constructor() {
    this.dataPath = path.join(process.cwd(), 'tournament-data');
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
    this.loadTeams();
  }

  private loadTeams(): void {
    try {
      const teamsFile = path.join(process.cwd(), 'teams-config.json');
      if (fs.existsSync(teamsFile)) {
        const data = fs.readFileSync(teamsFile, 'utf8');
        const teamsConfig = JSON.parse(data);

        Object.entries(teamsConfig.teams).forEach(([id, teamData]: [string, any]) => {
          this.teams.set(id, {
            id,
            name: teamData.name,
            color: teamData.color,
            players: teamData.players,
          });
        });

        console.log(`Loaded ${this.teams.size} teams`);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  }

  getTeams(): Team[] {
    return Array.from(this.teams.values());
  }

  getPlayerTeam(playerName: string): Team | undefined {
    return Array.from(this.teams.values()).find(team =>
      team.players.some(player =>
        player.toLowerCase() === playerName.toLowerCase() ||
        playerName.toLowerCase().includes(player.toLowerCase()) ||
        player.toLowerCase().includes(playerName.toLowerCase())
      )
    );
  }

  createSidegame(
    tournamentId: string,
    round: number,
    gameType: 'all-vs-all' | 'sum-match',
    groupings?: string[][]
  ): TeamSidegame {
    const sidegame: TeamSidegame = {
      id: uuidv4(),
      tournamentId,
      round,
      gameType,
      teams: this.getTeams(),
      groupings: gameType === 'all-vs-all' ? groupings : undefined,
      matches: [],
      createdAt: new Date().toISOString(),
    };

    this.sidegames.set(sidegame.id, sidegame);
    this.autoSave();
    return sidegame;
  }

  getSidegame(id: string): TeamSidegame | undefined {
    return this.sidegames.get(id);
  }

  getSidegameByRound(tournamentId: string, round: number): TeamSidegame | undefined {
    return Array.from(this.sidegames.values()).find(
      sg => sg.tournamentId === tournamentId && sg.round === round
    );
  }

  processHoleMatch(
    sidegameId: string,
    hole: number,
    holeResults: { [playerName: string]: number }
  ): TeamMatch | null {
    const sidegame = this.sidegames.get(sidegameId);
    if (!sidegame) return null;

    let teamPoints: { [teamId: string]: number } = {};
    sidegame.teams.forEach(team => {
      teamPoints[team.id] = 0;
    });

    if (sidegame.gameType === 'sum-match') {
      teamPoints = this.calculateSumMatchPoints(holeResults, hole);
    } else if (sidegame.gameType === 'all-vs-all') {
      teamPoints = this.calculateAllVsAllPoints(holeResults, sidegame.groupings || []);
    }

    const match: TeamMatch = {
      id: uuidv4(),
      sidegameId,
      hole,
      gameType: sidegame.gameType,
      participants: Object.keys(holeResults),
      teamPoints,
      holeResults,
      timestamp: new Date().toISOString(),
    };

    // Remove existing match for same hole if exists
    sidegame.matches = sidegame.matches.filter(m => m.hole !== hole);
    sidegame.matches.push(match);

    this.autoSave();
    return match;
  }

  private calculateSumMatchPoints(holeResults: { [playerName: string]: number }, hole: number): { [teamId: string]: number } {
    const teamPoints: { [teamId: string]: number } = {};
    const teamStrokesDifference: { [teamId: string]: number } = {};

    // Initialize team scores
    this.teams.forEach(team => {
      teamStrokesDifference[team.id] = 0;
      teamPoints[team.id] = 0;
    });

    // Calculate team strokes vs par for this hole
    Object.entries(holeResults).forEach(([playerName, strokesVsPar]) => {
      const team = this.getPlayerTeam(playerName);
      if (team) {
        // Special handling for green team (4 players) - alternate between Christer and Anders
        if (team.id === 'green' &&
            (playerName.includes('Christer') || playerName.includes('Anders'))) {

          const isChristersHole = hole % 2 === 0; // Even holes for Christer
          const isAndersHole = hole % 2 === 1;    // Odd holes for Anders

          if ((playerName.includes('Christer') && isChristersHole) ||
              (playerName.includes('Anders') && isAndersHole)) {
            teamStrokesDifference[team.id] += strokesVsPar;
          }
        } else if (team.id !== 'green' ||
                  (!playerName.includes('Christer') && !playerName.includes('Anders'))) {
          // For non-green teams, or green team members Daniel/Stefan
          teamStrokesDifference[team.id] += strokesVsPar;
        }
      }
    });

    // Find best (lowest strokes vs par) and worst (highest strokes vs par) teams
    const teamScores = Object.values(teamStrokesDifference);
    const bestScore = Math.min(...teamScores);
    const worstScore = Math.max(...teamScores);

    // Only award points if there's a clear difference
    if (bestScore !== worstScore) {
      // Find teams with best score (winners get +1 point each)
      const winners = Object.entries(teamStrokesDifference)
        .filter(([_, score]) => score === bestScore)
        .map(([teamId, _]) => teamId);

      // Find teams with worst score (losers get -1 point each)
      const losers = Object.entries(teamStrokesDifference)
        .filter(([_, score]) => score === worstScore)
        .map(([teamId, _]) => teamId);

      // Award points
      winners.forEach(teamId => {
        teamPoints[teamId] = 1;
      });

      losers.forEach(teamId => {
        teamPoints[teamId] = -1;
      });
    }

    return teamPoints;
  }

  private calculateAllVsAllPoints(
    holeResults: { [playerName: string]: number },
    groupings: string[][]
  ): { [teamId: string]: number } {
    const teamPoints: { [teamId: string]: number } = {};

    // Initialize team points
    this.teams.forEach(team => {
      teamPoints[team.id] = 0;
    });

    // Process each grouping
    groupings.forEach(group => {
      const groupPlayers = group.filter(playerName => playerName in holeResults);

      // Each player vs each other player in the group
      for (let i = 0; i < groupPlayers.length; i++) {
        for (let j = i + 1; j < groupPlayers.length; j++) {
          const player1 = groupPlayers[i];
          const player2 = groupPlayers[j];
          const team1 = this.getPlayerTeam(player1);
          const team2 = this.getPlayerTeam(player2);

          // Only count matches between different teams
          if (team1 && team2 && team1.id !== team2.id) {
            const score1 = holeResults[player1] || 0;
            const score2 = holeResults[player2] || 0;

            // For all-vs-all, we're comparing Stableford points (higher is better)
            // This logic is correct for Stableford points
            if (score1 > score2) {
              teamPoints[team1.id] += 1;
            } else if (score2 > score1) {
              teamPoints[team2.id] += 1;
            }
            // No points for ties
          }
        }
      }
    });

    return teamPoints;
  }

  generateTeamLeaderboard(sidegameId: string): TeamLeaderboardEntry[] {
    const sidegame = this.sidegames.get(sidegameId);
    if (!sidegame || sidegame.gameType !== 'sum-match') return [];

    // Get tournament data to calculate correct team points
    const activeTournament = this.loadActiveTournament();
    if (!activeTournament) return [];

    // Calculate team points for each hole based on tournament data
    const teamTotalPoints: { [teamId: string]: number } = {};
    sidegame.teams.forEach(team => {
      teamTotalPoints[team.id] = 0;
    });

    // Get all holes that have scores for any team members
    const holesWithScores = new Set<number>();
    for (const score of activeTournament.scores) {
      if (score.round === activeTournament.currentRound) {
        holesWithScores.add(score.hole);
      }
    }

    let matchesPlayed = 0;

    // Calculate team points for each hole
    holesWithScores.forEach(hole => {
      const teamStrokesDifference: { [teamId: string]: number } = {};
      this.teams.forEach(team => {
        teamStrokesDifference[team.id] = 0;
      });

      // Get scores for this hole from tournament data
      const holeScores = activeTournament.scores.filter(s =>
        s.hole === hole && s.round === activeTournament.currentRound
      );

      // Calculate team strokes vs par for this hole
      holeScores.forEach(score => {
        const player = activeTournament.players.find(p => p.id === score.playerId);
        if (!player) return;

        const team = this.getPlayerTeam(player.name);
        if (!team) return;

        const strokesVsPar = score.strokes - score.par;

        // Apply green team alternation logic
        if (team.id === 'green' &&
            (player.name.includes('Christer') || player.name.includes('Anders'))) {

          const isChristersHole = hole % 2 === 0;
          const isAndersHole = hole % 2 === 1;

          if ((player.name.includes('Christer') && isChristersHole) ||
              (player.name.includes('Anders') && isAndersHole)) {
            teamStrokesDifference[team.id] += strokesVsPar;
          }
        } else if (team.id !== 'green' ||
                  (!player.name.includes('Christer') && !player.name.includes('Anders'))) {
          teamStrokesDifference[team.id] += strokesVsPar;
        }
      });

      // Award points based on team performance for this hole
      const teamScores = Object.values(teamStrokesDifference);
      const bestScore = Math.min(...teamScores);
      const worstScore = Math.max(...teamScores);

      // Only award points if there's a clear difference
      if (bestScore !== worstScore) {
        // Find teams with best score (winners get +1 point each)
        const winners = Object.entries(teamStrokesDifference)
          .filter(([_, score]) => score === bestScore)
          .map(([teamId, _]) => teamId);

        // Find teams with worst score (losers get -1 point each)
        const losers = Object.entries(teamStrokesDifference)
          .filter(([_, score]) => score === worstScore)
          .map(([teamId, _]) => teamId);

        // Award points - only if sole winner/loser (no ties)
        if (winners.length === 1) {
          teamTotalPoints[winners[0]] += 1;
        }
        if (losers.length === 1) {
          teamTotalPoints[losers[0]] -= 1;
        }
      }

      matchesPlayed++;
    });

    const leaderboard: TeamLeaderboardEntry[] = sidegame.teams.map(team => {
      return {
        teamId: team.id,
        teamName: team.name,
        teamColor: team.color,
        totalPoints: teamTotalPoints[team.id] || 0,
        matchesPlayed,
        position: 0,
      };
    });

    // Sort by total points (descending)
    leaderboard.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return a.teamName.localeCompare(b.teamName);
    });

    // Assign positions
    leaderboard.forEach((entry, index) => {
      entry.position = index + 1;
    });

    return leaderboard;
  }

  getSumMatchLiveScorecard(sidegameId: string): { [hole: number]: { [teamId: string]: number } } {
    const sidegame = this.sidegames.get(sidegameId);
    if (!sidegame || sidegame.gameType !== 'sum-match') return {};

    // Get the tournament scoring data directly instead of relying on team matches
    const activeTournament = this.loadActiveTournament();
    if (!activeTournament) return {};

    const liveScorecard: { [hole: number]: { [teamId: string]: number } } = {};

    // Get all holes that have scores for any team members
    const holesWithScores = new Set<number>();
    for (const score of activeTournament.scores) {
      if (score.round === activeTournament.currentRound) {
        holesWithScores.add(score.hole);
      }
    }

    // Calculate team scores for each hole
    holesWithScores.forEach(hole => {
      const teamStrokesDifference: { [teamId: string]: number } = {};
      this.teams.forEach(team => {
        teamStrokesDifference[team.id] = 0;
      });

      // Get scores for this hole from tournament data
      const holeScores = activeTournament.scores.filter(s =>
        s.hole === hole && s.round === activeTournament.currentRound
      );

      holeScores.forEach(score => {
        const player = activeTournament.players.find(p => p.id === score.playerId);
        if (!player) return;

        const team = this.getPlayerTeam(player.name);
        if (!team) return;

        const strokesVsPar = score.strokes - score.par;

        // Apply green team alternation logic
        if (team.id === 'green' &&
            (player.name.includes('Christer') || player.name.includes('Anders'))) {

          const isChristersHole = hole % 2 === 0;
          const isAndersHole = hole % 2 === 1;

          if ((player.name.includes('Christer') && isChristersHole) ||
              (player.name.includes('Anders') && isAndersHole)) {
            teamStrokesDifference[team.id] += strokesVsPar;
          }
        } else if (team.id !== 'green' ||
                  (!player.name.includes('Christer') && !player.name.includes('Anders'))) {
          teamStrokesDifference[team.id] += strokesVsPar;
        }
      });

      liveScorecard[hole] = teamStrokesDifference;
    });

    return liveScorecard;
  }

  private loadActiveTournament(): Tournament | null {
    try {
      const tournamentsFile = path.join(this.dataPath, 'tournaments.json');
      if (!fs.existsSync(tournamentsFile)) {
        return null;
      }

      const data = fs.readFileSync(tournamentsFile, 'utf8');
      const tournamentsData = JSON.parse(data);

      // Find the active tournament (GA 2025)
      const tournaments = Object.values(tournamentsData) as Tournament[];
      return tournaments.find(t => t.name === 'GA 2025') || null;
    } catch (error) {
      console.error('Failed to load active tournament:', error);
      return null;
    }
  }

  // Persistence methods
  private saveSidegames(): void {
    if (this.saveInProgress) {
      console.log('Sidegame save already in progress, skipping...');
      return;
    }

    this.saveInProgress = true;
    try {
      const sidegamesObject = Object.fromEntries(this.sidegames);
      const dataFile = path.join(this.dataPath, 'sidegames.json');
      const tempFile = dataFile + '.tmp';

      fs.writeFileSync(tempFile, JSON.stringify(sidegamesObject, null, 2));
      fs.renameSync(tempFile, dataFile);

      console.log('Sidegame data saved successfully');
    } catch (error) {
      console.error('Failed to save sidegame data:', error);
      const tempFile = path.join(this.dataPath, 'sidegames.json.tmp');
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } finally {
      this.saveInProgress = false;
    }
  }

  loadSidegames(): void {
    try {
      const dataFile = path.join(this.dataPath, 'sidegames.json');
      if (fs.existsSync(dataFile)) {
        const data = fs.readFileSync(dataFile, 'utf8');
        const sidegamesObject = JSON.parse(data);
        this.sidegames = new Map(Object.entries(sidegamesObject));
        console.log(`Loaded ${this.sidegames.size} sidegames from storage`);
      } else {
        console.log('No existing sidegame data found');
      }
    } catch (error) {
      console.error('Failed to load sidegame data:', error);
    }
  }

  private autoSave(): void {
    this.saveSidegames();
  }

  // Clear all sidegames for a specific tournament
  clearTournamentSidegames(tournamentId: string): void {
    const sidegamesToDelete = Array.from(this.sidegames.values())
      .filter(sidegame => sidegame.tournamentId === tournamentId);

    sidegamesToDelete.forEach(sidegame => {
      this.sidegames.delete(sidegame.id);
    });

    if (sidegamesToDelete.length > 0) {
      this.autoSave();
      console.log(`Cleared ${sidegamesToDelete.length} sidegames for tournament: ${tournamentId}`);
    }
  }
}