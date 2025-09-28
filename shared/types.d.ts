import { z } from 'zod';
export declare const PlayerSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    currentHole: z.ZodNumber;
    handicap: z.ZodOptional<z.ZodNumber>;
    receivedStrokes: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    currentHole: number;
    handicap?: number | undefined;
    receivedStrokes?: number | undefined;
}, {
    id: string;
    name: string;
    currentHole: number;
    handicap?: number | undefined;
    receivedStrokes?: number | undefined;
}>;
export declare const ScoreEntrySchema: z.ZodObject<{
    playerId: z.ZodString;
    hole: z.ZodNumber;
    round: z.ZodNumber;
    strokes: z.ZodNumber;
    par: z.ZodNumber;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    playerId: string;
    hole: number;
    round: number;
    strokes: number;
    par: number;
    timestamp: string;
}, {
    playerId: string;
    hole: number;
    round: number;
    strokes: number;
    par: number;
    timestamp: string;
}>;
export declare const ScoringUpdateSchema: z.ZodObject<{
    player: z.ZodString;
    hole: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    strokes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    action: z.ZodEnum<["birdie", "eagle", "par", "bogey", "double_bogey", "score", "delete"]>;
    rawTranscription: z.ZodString;
}, "strip", z.ZodTypeAny, {
    player: string;
    action: "par" | "birdie" | "eagle" | "bogey" | "double_bogey" | "score" | "delete";
    rawTranscription: string;
    hole?: number | null | undefined;
    strokes?: number | null | undefined;
}, {
    player: string;
    action: "par" | "birdie" | "eagle" | "bogey" | "double_bogey" | "score" | "delete";
    rawTranscription: string;
    hole?: number | null | undefined;
    strokes?: number | null | undefined;
}>;
export declare const LeaderboardEntrySchema: z.ZodObject<{
    playerId: z.ZodString;
    playerName: z.ZodString;
    totalStrokes: z.ZodNumber;
    holesCompleted: z.ZodNumber;
    currentScore: z.ZodNumber;
    position: z.ZodNumber;
    holeScores: z.ZodOptional<z.ZodArray<z.ZodNullable<z.ZodNumber>, "many">>;
    holePars: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    stablefordPoints: z.ZodOptional<z.ZodArray<z.ZodNullable<z.ZodNumber>, "many">>;
    totalStablefordPoints: z.ZodOptional<z.ZodNumber>;
    averageStablefordPoints: z.ZodOptional<z.ZodNumber>;
    stablefordVsPar: z.ZodOptional<z.ZodNumber>;
    handicap: z.ZodOptional<z.ZodNumber>;
    receivedStrokes: z.ZodOptional<z.ZodNumber>;
    roundScores: z.ZodOptional<z.ZodArray<z.ZodObject<{
        round: z.ZodNumber;
        holeScores: z.ZodArray<z.ZodNullable<z.ZodNumber>, "many">;
        stablefordPoints: z.ZodArray<z.ZodNullable<z.ZodNumber>, "many">;
        roundStrokes: z.ZodNumber;
        roundStablefordPoints: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        round: number;
        holeScores: (number | null)[];
        stablefordPoints: (number | null)[];
        roundStrokes: number;
        roundStablefordPoints: number;
    }, {
        round: number;
        holeScores: (number | null)[];
        stablefordPoints: (number | null)[];
        roundStrokes: number;
        roundStablefordPoints: number;
    }>, "many">>;
    totalRounds: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    playerId: string;
    playerName: string;
    totalStrokes: number;
    holesCompleted: number;
    currentScore: number;
    position: number;
    handicap?: number | undefined;
    receivedStrokes?: number | undefined;
    holeScores?: (number | null)[] | undefined;
    holePars?: number[] | undefined;
    stablefordPoints?: (number | null)[] | undefined;
    totalStablefordPoints?: number | undefined;
    averageStablefordPoints?: number | undefined;
    stablefordVsPar?: number | undefined;
    roundScores?: {
        round: number;
        holeScores: (number | null)[];
        stablefordPoints: (number | null)[];
        roundStrokes: number;
        roundStablefordPoints: number;
    }[] | undefined;
    totalRounds?: number | undefined;
}, {
    playerId: string;
    playerName: string;
    totalStrokes: number;
    holesCompleted: number;
    currentScore: number;
    position: number;
    handicap?: number | undefined;
    receivedStrokes?: number | undefined;
    holeScores?: (number | null)[] | undefined;
    holePars?: number[] | undefined;
    stablefordPoints?: (number | null)[] | undefined;
    totalStablefordPoints?: number | undefined;
    averageStablefordPoints?: number | undefined;
    stablefordVsPar?: number | undefined;
    roundScores?: {
        round: number;
        holeScores: (number | null)[];
        stablefordPoints: (number | null)[];
        roundStrokes: number;
        roundStablefordPoints: number;
    }[] | undefined;
    totalRounds?: number | undefined;
}>;
export declare const AudioChunkSchema: z.ZodObject<{
    data: z.ZodAny;
    timestamp: z.ZodNumber;
    sessionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: number;
    sessionId: string;
    data?: any;
}, {
    timestamp: number;
    sessionId: string;
    data?: any;
}>;
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
export interface WebSocketMessage {
    type: 'audio_chunk' | 'scoring_update' | 'leaderboard_update' | 'transcription';
    data: any;
    timestamp: number;
}
//# sourceMappingURL=types.d.ts.map