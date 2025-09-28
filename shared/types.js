"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioChunkSchema = exports.LeaderboardEntrySchema = exports.ScoringUpdateSchema = exports.ScoreEntrySchema = exports.PlayerSchema = void 0;
const zod_1 = require("zod");
exports.PlayerSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    currentHole: zod_1.z.number().min(1).max(18),
    handicap: zod_1.z.number().optional(),
    receivedStrokes: zod_1.z.number().optional(),
});
exports.ScoreEntrySchema = zod_1.z.object({
    playerId: zod_1.z.string(),
    hole: zod_1.z.number().min(1).max(18),
    round: zod_1.z.number().min(1),
    strokes: zod_1.z.number().min(1),
    par: zod_1.z.number().min(3).max(5),
    timestamp: zod_1.z.string().datetime(),
});
exports.ScoringUpdateSchema = zod_1.z.object({
    player: zod_1.z.string(),
    hole: zod_1.z.number().nullable().optional(),
    strokes: zod_1.z.number().nullable().optional(),
    action: zod_1.z.enum(['birdie', 'eagle', 'par', 'bogey', 'double_bogey', 'score', 'delete']),
    rawTranscription: zod_1.z.string(),
});
exports.LeaderboardEntrySchema = zod_1.z.object({
    playerId: zod_1.z.string(),
    playerName: zod_1.z.string(),
    totalStrokes: zod_1.z.number(),
    holesCompleted: zod_1.z.number(),
    currentScore: zod_1.z.number(),
    position: zod_1.z.number(),
    holeScores: zod_1.z.array(zod_1.z.number().nullable()).optional(),
    holePars: zod_1.z.array(zod_1.z.number()).optional(),
    stablefordPoints: zod_1.z.array(zod_1.z.number().nullable()).optional(),
    totalStablefordPoints: zod_1.z.number().optional(),
    averageStablefordPoints: zod_1.z.number().optional(),
    stablefordVsPar: zod_1.z.number().optional(),
    handicap: zod_1.z.number().optional(),
    receivedStrokes: zod_1.z.number().optional(),
    // Multi-round support
    roundScores: zod_1.z.array(zod_1.z.object({
        round: zod_1.z.number(),
        holeScores: zod_1.z.array(zod_1.z.number().nullable()),
        stablefordPoints: zod_1.z.array(zod_1.z.number().nullable()),
        roundStrokes: zod_1.z.number(),
        roundStablefordPoints: zod_1.z.number(),
    })).optional(),
    totalRounds: zod_1.z.number().optional(),
});
exports.AudioChunkSchema = zod_1.z.object({
    data: zod_1.z.any(), // Buffer in Node.js, Uint8Array in browser
    timestamp: zod_1.z.number(),
    sessionId: zod_1.z.string(),
});
//# sourceMappingURL=types.js.map