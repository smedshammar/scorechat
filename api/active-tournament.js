export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Mock tournament data for now
  const mockTournament = {
    id: "demo-tournament",
    name: "Demo Golf Tournament",
    course: "Demo Golf Course",
    courseRating: 72.1,
    slopeRating: 125,
    par: [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 4], // 18 holes
    players: [
      {
        id: "player1",
        name: "Demo Player 1",
        currentHole: 1,
        handicap: 18
      },
      {
        id: "player2",
        name: "Demo Player 2",
        currentHole: 1,
        handicap: 12
      }
    ],
    scores: [],
    createdAt: new Date().toISOString(),
    totalRounds: 1,
    currentRound: 1
  };

  res.status(200).json(mockTournament);
}