import { z } from 'zod';

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  currentHole: z.number().min(1).max(18),
  handicap: z.number().optional(),
  receivedStrokes: z.number().optional(),
});

export const ScoreEntrySchema = z.object({
  playerId: z.string(),
  hole: z.number().min(1).max(18),
  round: z.number().min(1),
  strokes: z.number().min(1),
  par: z.number().min(3).max(5),
  timestamp: z.string().datetime(),
});

export const ScoringUpdateSchema = z.object({
  player: z.string(),
  hole: z.number().nullable().optional(),
  strokes: z.number().nullable().optional(),
  action: z.enum(['birdie', 'eagle', 'par', 'bogey', 'double_bogey', 'score', 'delete']),
  rawTranscription: z.string(),
});

export const LeaderboardEntrySchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  totalStrokes: z.number(),
  holesCompleted: z.number(),
  currentScore: z.number(),
  position: z.number(),
  holeScores: z.array(z.number().nullable()).optional(),
  holePars: z.array(z.number()).optional(),
  stablefordPoints: z.array(z.number().nullable()).optional(),
  totalStablefordPoints: z.number().optional(),
  averageStablefordPoints: z.number().optional(),
  stablefordVsPar: z.number().optional(),
  handicap: z.number().optional(),
  receivedStrokes: z.number().optional(),
  // Multi-round support
  roundScores: z.array(z.object({
    round: z.number(),
    holeScores: z.array(z.number().nullable()),
    stablefordPoints: z.array(z.number().nullable()),
    roundStrokes: z.number(),
    roundStablefordPoints: z.number(),
  })).optional(),
  totalRounds: z.number().optional(),
});

export const AudioChunkSchema = z.object({
  data: z.any(), // Buffer in Node.js, Uint8Array in browser
  timestamp: z.number(),
  sessionId: z.string(),
});

export type Player = z.infer<typeof PlayerSchema>;
export type ScoreEntry = z.infer<typeof ScoreEntrySchema>;
export type ScoringUpdate = z.infer<typeof ScoringUpdateSchema>;
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;
export type AudioChunk = z.infer<typeof AudioChunkSchema>;

export interface Tournament {
  id: string;
  name: string;
  course: string;
  courseRating: number;
  slopeRating: number;
  par: number[];
  players: Player[];
  scores: ScoreEntry[];
  createdAt: string;
  totalRounds: number;
  currentRound: number;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  players: string[];
}

export interface TeamSidegame {
  id: string;
  tournamentId: string;
  round: number;
  gameType: 'all-vs-all' | 'sum-match';
  teams: Team[];
  groupings?: string[][]; // For all-vs-all groupings
  matches: TeamMatch[];
  createdAt: string;
}

export interface TeamMatch {
  id: string;
  sidegameId: string;
  hole: number;
  gameType: 'all-vs-all' | 'sum-match';
  participants: string[]; // Player names
  teamPoints: { [teamId: string]: number };
  holeResults: { [playerName: string]: number }; // Stableford points for the hole
  timestamp: string;
}

export interface TeamLeaderboardEntry {
  teamId: string;
  teamName: string;
  teamColor: string;
  totalPoints: number;
  matchesPlayed: number;
  position: number;
}

export interface WebSocketMessage {
  type: 'audio_chunk' | 'scoring_update' | 'leaderboard_update' | 'transcription' | 'score_verification_data' | 'team_match_update' | 'team_leaderboard_update';
  data: any;
  timestamp: number;
}