export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // For now, return a mock response since we need OpenAI API key set up
  const mockResponse = {
    transcription: "Demo transcription - Player 1 scored a par on hole 1",
    scoringUpdate: {
      player: "Player 1",
      hole: 1,
      strokes: 4,
      action: "par",
      rawTranscription: "Demo transcription - Player 1 scored a par on hole 1"
    },
    scoreEntry: {
      playerId: "player1",
      hole: 1,
      round: 1,
      strokes: 4,
      par: 4,
      timestamp: new Date().toISOString()
    }
  };

  res.status(200).json(mockResponse);
}