import OpenAI from 'openai';
import { ScoringUpdateSchema, type ScoringUpdate } from '../types';

export class TranscriptionService {
  private openai: OpenAI | null = null;
  private hasApiKey: boolean = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn('OPENAI_API_KEY environment variable is not set - using mock responses');
      this.hasApiKey = false;
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      console.warn('Invalid OpenAI API key format. Key should start with "sk-" - using mock responses');
      this.hasApiKey = false;
      return;
    }

    console.log('Initializing OpenAI client with API key:', apiKey.substring(0, 10) + '...');
    this.hasApiKey = true;

    this.openai = new OpenAI({
      apiKey: apiKey,
      timeout: 30000, // 30 second timeout
      maxRetries: 3,
    });
  }

  async transcribeAudio(audioBuffer: Buffer, playerNames: string[] = []): Promise<string> {
    if (!this.hasApiKey || !this.openai) {
      console.warn('No OpenAI API key available, returning mock transcription');
      return "Demo transcription - Player 1 scored a par on hole 1";
    }

    try {
      console.log('Starting audio transcription, buffer size:', audioBuffer.length, 'bytes');

      // Convert buffer to blob for better compatibility
      const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
      const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });

      console.log('Created file object, size:', file.size, 'bytes, type:', file.type);

      // Include player names in the prompt for better recognition
      const playerContext = playerNames.length > 0
        ? ` Players competing: ${playerNames.join(', ')}.`
        : '';

      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        prompt: `This is a golf scoring update during live play. The speaker is reporting individual scores for consecutive holes, NOT phone numbers or codes. When hearing multiple scores like "four five three four", transcribe as separate numbers: "4 5 3 4" not "4-5-3-4". Golf context: Players are competing on an 18-hole course with standard par values.${playerContext}`,
        language: 'en',
      });

      console.log('Transcription successful:', transcription.text);
      return transcription.text;
    } catch (error: any) {
      console.error('Transcription error details:', {
        message: error?.message,
        status: error?.status,
        type: error?.type,
        code: error?.code,
        cause: error?.cause
      });

      if (error instanceof Error) {
        throw new Error(`Failed to transcribe audio: ${error.message}`);
      }
      throw new Error('Failed to transcribe audio: Unknown error');
    }
  }

  async parseTranscriptionToScore(transcription: string, playerNames: string[] = []): Promise<ScoringUpdate[]> {
    if (!this.hasApiKey || !this.openai) {
      console.warn('No OpenAI API key available, returning mock scoring update');
      return [{
        player: '',
        action: 'score',
        rawTranscription: transcription,
      }];
    }

    // Pre-process transcription to normalize dash-separated sequences
    const normalizedTranscription = this.normalizeTranscription(transcription);
    const playerNamesContext = playerNames.length > 0
      ? `\n\nKnown player names: ${playerNames.join(', ')}`
      : '';

    const golfContext = `
You are a golf scoring system. Parse the following transcription of a spoken golf scoring update.

Golf scoring terms:
- Eagle: 2 under par
- Birdie: 1 under par
- Par: Even with par
- Bogey: 1 over par
- Double bogey: 2 over par

Extract:
- Player name (if mentioned)
- Hole number (1-18, if mentioned)
- Score type (birdie, eagle, par, bogey, double_bogey) or specific stroke count
- Any specific number of strokes${playerNamesContext}

IMPORTANT - Sequential Scoring Patterns:
When you see patterns like "from hole 6, 4 5 3 4" or "starting at hole 3: 3 4 5 6", this means:
- The first number after the starting hole is the score FOR that hole
- Each subsequent number is the score for the NEXT consecutive hole

Examples:
- "from hole 6, 4 5 3 4" means: hole 6=4 strokes, hole 7=5 strokes, hole 8=3 strokes, hole 9=4 strokes
- "Tiger starting hole 10: 3 5 4" means: hole 10=3 strokes, hole 11=5 strokes, hole 12=4 strokes
- "Jordan from hole 1, birdie par bogey" means: hole 1=birdie, hole 2=par, hole 3=bogey

CORRECTION/DELETION Commands:
When you see correction requests like "remove that score", "delete Jordan's score on hole 5", "Jordan didn't play hole 5", return deletion objects:
- Use action: "delete" for these requests
- Extract the player and hole number if mentioned
- Set strokes to null for deletions

Examples:
- "Remove Jordan's score on hole 5" → {"player": "Jordan Spieth", "hole": 5, "strokes": null, "action": "delete"}
- "Tiger didn't play hole 3" → {"player": "Tiger Woods", "hole": 3, "strokes": null, "action": "delete"}
- "Delete that score" → {"player": "", "hole": null, "strokes": null, "action": "delete"}

If multiple players or scores are mentioned, extract ALL scoring updates as separate objects.
If the transcription contains no scoring information (just corrections/deletions), return the deletion objects.
If the transcription contains no useful golf information at all, return an empty array.

Return a JSON array containing all scoring updates found in the transcription:
[
  {
    "player": "player name or empty string",
    "hole": hole_number_or_null,
    "strokes": stroke_count_or_null,
    "action": "one of: birdie, eagle, par, bogey, double_bogey, score, delete"
  }
]

Note: Use null (not undefined) for missing hole or strokes values.

Transcription: "${normalizedTranscription}"
`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a precise golf scoring parser. Handle sequential scoring patterns correctly: "from hole 6, 4 5 3 4" means hole 6=4, hole 7=5, hole 8=3, hole 9=4. When you see space-separated numbers after a starting hole, each number represents the score for consecutive holes. Return ONLY a valid JSON array of scoring objects, no other text, no explanations.'
          },
          {
            role: 'user',
            content: golfContext
          }
        ],
        temperature: 0.1,
      });

      const responseText = completion.choices[0]?.message?.content?.trim();
      if (!responseText) {
        throw new Error('No response from OpenAI');
      }

      console.log('GPT-4 raw response:', responseText);

      // Clean up the response to ensure it's valid JSON
      let cleanResponse = responseText;
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsedData = JSON.parse(cleanResponse);

      // Ensure we have an array
      const arrayData = Array.isArray(parsedData) ? parsedData : [parsedData];

      // Empty array is valid (e.g., for non-scoring transcriptions)
      if (!arrayData.length) {
        console.log('Empty array returned - no scoring updates found');
        return [];
      }

      // Post-process to fix sequential scoring patterns if needed
      const processedData = this.fixSequentialScoring(arrayData, normalizedTranscription);

      // Return all scoring updates with rawTranscription added
      const finalData = processedData.map(item => ({
        ...item,
        rawTranscription: transcription
      }));

      return finalData.map(item => ScoringUpdateSchema.parse(item));
    } catch (error) {
      console.error('Score parsing error:', error);
      console.error('Original transcription:', transcription);

      // Return fallback array with one object
      return [{
        player: '',
        action: 'score',
        rawTranscription: transcription,
      }];
    }
  }

  private fixSequentialScoring(scoringUpdates: any[], transcription: string): any[] {
    // Check if this looks like a sequential pattern that GPT-4 might have misinterpreted
    const sequentialPattern = /(?:from|starting at|at)\s+hole\s+(\d+).*?(?:[:,]?\s*)([\d\s,]+)/i;
    const match = transcription.match(sequentialPattern);

    if (!match) return scoringUpdates;

    const startHole = parseInt(match[1]);
    const scoresString = match[2];

    // Extract individual scores from space-separated pattern like "4 5 3 4"
    const scores = scoresString
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(s => s && /^\d+$/.test(s))
      .map(s => parseInt(s));

    if (scores.length === 0) return scoringUpdates;

    console.log(`Found sequential pattern: starting hole ${startHole}, scores: [${scores.join(', ')}]`);

    // Check if all scoring updates have the same hole number (indicating GPT-4 error)
    const firstHole = scoringUpdates[0]?.hole;
    const sameHoleError = scoringUpdates.every(update => update.hole === firstHole) &&
                         scoringUpdates.length === scores.length &&
                         firstHole === startHole;

    if (sameHoleError) {
      console.log(`Detected sequential scoring error. Fixing hole numbers starting from ${startHole}`);

      // Fix the hole numbers to be sequential
      return scoringUpdates.map((update, index) => ({
        ...update,
        hole: startHole + index,
        strokes: scores[index] || update.strokes
      }));
    }

    // Also check if GPT-4 created multiple updates but with wrong hole assignments
    if (scoringUpdates.length === scores.length && scores.length > 1) {
      const allHolesSet = new Set(scoringUpdates.map(u => u.hole));
      const expectedHoles = Array.from({length: scores.length}, (_, i) => startHole + i);
      const hasCorrectHoles = expectedHoles.every(h => allHolesSet.has(h));

      if (!hasCorrectHoles) {
        console.log(`Fixing hole sequence to match expected pattern`);
        return scoringUpdates.map((update, index) => ({
          ...update,
          hole: startHole + index,
          strokes: scores[index] || update.strokes
        }));
      }
    }

    return scoringUpdates;
  }

  private normalizeTranscription(transcription: string): string {
    let normalized = transcription;

    console.log('Original transcription:', transcription);

    // Replace dash-separated digit sequences with space-separated sequences
    // This handles patterns like "4-5-3-4" -> "4 5 3 4"
    normalized = normalized.replace(/(\d)-(\d)/g, '$1 $2');

    // Handle multiple consecutive replacements for longer sequences
    // This ensures "4-5-3-4-6" becomes "4 5 3 4 6"
    while (normalized.includes('-') && /\d-\d/.test(normalized)) {
      normalized = normalized.replace(/(\d)-(\d)/g, '$1 $2');
    }

    // Replace comma-separated digits with spaces for consistency
    normalized = normalized.replace(/(\d),(\d)/g, '$1 $2');

    // Clean up multiple spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();

    if (normalized !== transcription) {
      console.log('Normalized transcription:', normalized);
    }

    return normalized;
  }
}