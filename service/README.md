# On the Spectrum Service

AWS CDK-based serverless backend for the "On the Spectrum" multiplayer color communication game.

## Architecture

- **WebSocket API**: Real-time multiplayer communication
- **DynamoDB**: Game state and connection persistence  
- **Lambda**: Serverless compute for all operations

## WebSocket Communication

For detailed information about client-server communication, including all supported actions, events, and message formats, see:

**[WebSocket Communication Documentation](../docs/CLIENT_SERVER_COMMUNICATION.md)**

### Quick Examples

#### Join Game
```json
{
  "action": "joinGame",
  "gameId": "ABC123",
  "playerName": "PlayerName"
}
```

#### Submit Color
```json
{
  "action": "submitColor",
  "gameId": "ABC123",
  "playerId": "xyz789",
  "data": {
    "color": { "h": 180, "s": 75, "l": 50 }
  }
}
```

## Game State Structure

```json
{
  "gameId": "ABC123",
  "config": {
    "maxPlayers": 10,
    "descriptionTimeLimit": 30,
    "guessingTimeLimit": 15,
    "turnsPerPlayer": 1
  },
  "meta": {
    "status": "waiting|playing|finished",
    "currentRound": 0,
    "createdAt": "2026-01-02T01:26:10.509Z"
  },
  "players": [
    {
      "playerId": "xyz789",
      "playerName": "Player1",
      "joinedAt": "2026-01-02T01:26:10.509Z",
      "score": 85,
      "draftColor": { "h": 175, "s": 80, "l": 45 },
      "draftDescription": "ocean blue"
    }
  ],
  "gameplay": {
    "rounds": [
      {
        "targetColor": { "h": 180, "s": 75, "l": 50 },
        "startedAt": "2026-01-02T01:26:10.509Z",
        "describerId": "xyz789",
        "description": "deep ocean water",
        "phase": "guessing",
        "submissions": {
          "abc456": { "h": 175, "s": 80, "l": 45 }
        },
        "scores": {
          "abc456": 92
        },
        "timers": {
          "descriptionDeadline": "2026-01-02T01:26:40.509Z",
          "guessingDeadline": "2026-01-02T01:26:55.509Z"
        }
      }
    ]
  }
}
```

## HSL Color Format

All colors use HSL (Hue, Saturation, Lightness) format:
- **H**: 0-360 (degrees)
- **S**: 0-100 (percentage)
- **L**: 0-100 (percentage)

This ensures players can select any valid color across the complete spectrum.

## Deployment

```bash
npm run build
npx cdk deploy
```

## Testing

```bash
# Run unit tests
npm test

# Test API endpoints (update URL in script)
./bin/test-service.sh
```
