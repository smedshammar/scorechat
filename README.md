# ScoreChat Golf

A real-time web application for streaming spoken golf scoring updates during live play. The app uses voice recognition to transcribe scoring updates, processes them with AI to extract golf-specific scoring data, and displays live leaderboards.

## Features

- **Voice Recording**: Real-time audio capture from web browser
- **Speech-to-Text**: OpenAI Whisper integration for accurate transcription
- **AI Scoring Parser**: GPT-4 powered parsing of golf scoring terminology
- **Real-time Updates**: WebSocket-based live leaderboard updates
- **Golf-Aware Processing**: Context-aware transcription and scoring logic

## Architecture

### Server (`/server`)
- Express.js API server
- WebSocket communication via Socket.IO
- OpenAI integration for transcription and parsing
- Golf scoring logic and leaderboard generation

### Client (`/client`)
- React + TypeScript frontend
- Real-time audio recording with MediaRecorder API
- Socket.IO client for live updates
- Responsive golf tournament UI

### Shared (`/shared`)
- TypeScript types and schemas shared between client and server
- Zod validation schemas for data integrity

## Setup

### Prerequisites
- Node.js 18+
- OpenAI API key

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
cd server && npm install
cd ../client && npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

4. Start the development servers:
```bash
npm run dev
```

This will start:
- Server on http://localhost:3001
- Client on http://localhost:5173

## Usage

1. Open the web application in your browser
2. Click "Start Recording" to begin voice input
3. Speak golf scoring updates like:
   - "Tiger Woods birdie on hole 7"
   - "Jordan Spieth got a double bogey"
   - "Rory scored 4 on the par 3"
4. Watch real-time transcription and leaderboard updates

## Golf Scoring Terms Supported

- **Eagle**: 2 under par
- **Birdie**: 1 under par
- **Par**: Even with par
- **Bogey**: 1 over par
- **Double Bogey**: 2 over par
- **Specific stroke counts**: "scored 4", "got a 5", etc.

## API Endpoints

- `POST /api/audio` - Upload audio for transcription and processing
- `GET /api/active-tournament` - Get current tournament data
- `GET /api/tournament/:id/leaderboard` - Get tournament leaderboard
- `GET /api/tournament/:id/player/:playerId/scorecard` - Get player scorecard

## WebSocket Events

- `transcription` - Raw transcription results
- `scoring_update` - Processed scoring data
- `leaderboard_update` - Updated leaderboard data

## Development

### Running Tests
```bash
# Server tests
cd server && npm test

# Client tests
cd client && npm test
```

### Building for Production
```bash
npm run build
```

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key for Whisper and GPT-4
- `PORT`: Server port (default: 3001)

## License

MIT License