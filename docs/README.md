# RGB Documentation

Technical documentation for the On the Spectrum color guessing game.

## Documentation Files

### [CHANGELOG.md](./CHANGELOG.md)
Running log of notable changes to On the Spectrum.

**Use this for**: Tracking what's new, release notes, contributor context

---

### [presentation.md](./presentation.md)
Presentation guide covering gameplay, technology, and Kiro spec-driven development.

**Contents**:
- Game overview and demo flow (multiplayer + daily challenge)
- Architecture and tech stack deep-dive
- Custom HSL color wheel engineering
- Scoring algorithms explained
- Amazon Kiro spec-driven development workflow
- Steering docs and spec structure
- Key takeaways and quick reference

**Use this for**: Live demos, presentations, onboarding new contributors

---

### [websocket.md](./websocket.md)
Complete WebSocket API documentation for multiplayer gameplay.

**Contents**:
- Connection architecture and lifecycle
- All client actions (createGame, joinGame, startRound, etc.)
- Server events and broadcasting
- Describer selection algorithm
- Regional game codes
- Special scoring cases
- Error handling and security

**Use this for**: Building multiplayer game clients, understanding real-time communication flow

---

### [rest-api.md](./rest-api.md)
REST API documentation for Daily Challenge mode.

**Contents**:
- All REST endpoints (GET /daily-challenge/current, POST /daily-challenge/submit, etc.)
- Request/response formats
- Data models and types
- Challenge lifecycle
- Rate limiting and CORS
- Example usage

**Use this for**: Implementing daily challenge features, asynchronous gameplay

---

### [daily-game-patterns.md](./daily-game-patterns.md)
Research-backed design patterns for daily puzzle games, applied to On the Spectrum.

**Contents**:
- Core engagement mechanics (one-per-day, FOMO, habit formation)
- Scoring and feedback patterns
- Social and sharing mechanics (spoiler-free share cards)
- Accessibility and archive design
- Retention mechanics (streaks, streak protection)
- Community dynamics and the shared puzzle experience
- Psychological principles and design recommendations

**Use this for**: Product decisions, feature prioritisation, understanding the design context of the daily challenge mode

---

### [hsl-color-scoring.md](./hsl-color-scoring.md)
Deep dive into HSL color space and scoring algorithms.

**Contents**:
- HSL color space explanation
- Double cone geometry
- Geometric normal distribution scoring algorithm
- Component weights and sigma values
- Dynamic tolerance adjustments
- Scoring examples and edge cases

**Use this for**: Understanding color distance calculations, implementing scoring logic

---

## Quick Start

### Multiplayer Game Flow
1. **Connect**: Establish WebSocket connection to `wss://ws.rgb.mcteamster.com`
2. **Create/Join**: Send `createGame` or `joinGame` action
3. **Start Round**: Host sends `startRound` (describer auto-selected)
4. **Describe**: Describer sends `submitDescription`
5. **Guess**: Other players send `submitColor`
6. **Reveal**: Scores calculated and displayed
7. **Repeat**: Continue until all players complete `turnsPerPlayer` turns

See [websocket.md](./websocket.md) for detailed message formats.

### Daily Challenge Flow
1. **Fetch**: GET `/daily-challenge/current?userId={userId}` to get today's challenge
2. **Select**: User picks color based on prompt
3. **Submit**: POST `/daily-challenge/submit` with color and userId
4. **Score**: Receive score based on distance from community average
5. **History**: GET `/daily-challenge/history/{userId}` to view past submissions

See [rest-api.md](./rest-api.md) for detailed endpoint documentation.

---

## Key Concepts

### HSL Color Space
- **Hue (H)**: 0-360° - Color type on the wheel
- **Saturation (S)**: 0-100% - Color intensity/purity
- **Lightness (L)**: 0-100% - Brightness level

Generated colors: H: 0-360°, S: 20-100%, L: 15-85%  
Players can guess: H: 0-360°, S: 0-100%, L: 0-100%

### Scoring Algorithm
**Geometric Normal Distribution** (multiplayer) with:
- Component weights: Hue (6.0), Saturation (1.0), Lightness (2.0)
- 3-sigma cutoff: Beyond 3 standard deviations = 0 points
- Dynamic adjustments for extreme lightness values
- Prevents compensation between components

**Bicone Distance** (daily challenge) with:
- Euclidean distance in 3D bicone Cartesian space
- Linear scaling: 100 × (1 - distance/maxDistance)
- Measures consensus against community average
- No cutoff - all submissions contribute

Perfect match = 100 points, completely wrong = 0 points (multiplayer) or ~0 points (daily)

### Game Modes

**Multiplayer** (WebSocket):
- 2-10 players, real-time
- Configurable time limits (or unlimited)
- Host-controlled game flow
- Describer rotation algorithm

**Daily Challenge** (REST API):
- Single-player, asynchronous
- New prompt every UTC midnight
- Score against community average
- History and statistics tracking

---

## Architecture Overview

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       ├─── WebSocket ───┐
       │                 │
       └─── REST API ────┤
                         │
                    ┌────▼────┐
                    │   API   │
                    │ Gateway │
                    └────┬────┘
                         │
              ┌──────────┴──────────┐
              │                     │
         ┌────▼────┐          ┌────▼────┐
         │ Lambda  │          │ Lambda  │
         │WebSocket│          │  REST   │
         └────┬────┘          └────┬────┘
              │                     │
              └──────────┬──────────┘
                         │
                    ┌────▼────┐
                    │DynamoDB │
                    │  Tables │
                    └─────────┘
```

### Tables
- **Games**: Multiplayer game state (WebSocket)
- **Connections**: WebSocket connection mappings
- **Challenges**: Daily challenge data (REST)
- **Submissions**: User submission history (REST)

---

## Regional Deployment

RGB is deployed across multiple AWS regions for optimal latency:

| Region | Code | Location |
|--------|------|----------|
| ap-southeast-2 | BC | Australia 🇦🇺 |
| ap-northeast-1 | DF | Japan 🇯🇵 |
| ap-southeast-1 | GH | Singapore 🇸🇬 |
| ap-south-1 | JK | India 🇮🇳 |
| eu-central-1 | LM | Europe 🇪🇺 |
| eu-west-2 | NP | UK 🇬🇧 |
| sa-east-1 | QR | Brazil 🇧🇷 |
| us-east-1 | ST | US East 🇺🇸 |
| us-west-2 | VW | US West 🇺🇸 |

Game codes encode the region (e.g., `XYZS` = US East)

---

## Common Patterns

### Reconnection Handling
```javascript
// Store session for reconnection
localStorage.setItem('rgb-game-id', gameId);
localStorage.setItem('rgb-player-id', playerId);

// On reconnect
ws.send(JSON.stringify({
  action: 'rejoinGame',
  gameId: localStorage.getItem('rgb-game-id'),
  playerId: localStorage.getItem('rgb-player-id')
}));
```

### Draft Updates (Debounced)
```javascript
let draftTimeout;
function updateDraft(color) {
  clearTimeout(draftTimeout);
  draftTimeout = setTimeout(() => {
    ws.send(JSON.stringify({
      action: 'updateDraftColor',
      gameId, playerId,
      data: { color }
    }));
  }, 100); // Debounce 100ms
}
```

### Error Handling
```javascript
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'error') {
    console.error('Game error:', data.error);
    // Show user-friendly error message
    showError(data.error);
  }
});
```

---

## Testing

### Local Development
- WebSocket: `ws://localhost:3001`
- REST API: `http://localhost:3000`

### Production
- WebSocket: `wss://ws.rgb.mcteamster.com`
- REST API: `https://rest.rgb.mcteamster.com`

---

## Additional Resources

- **Main README**: [../README.md](../README.md)
- **Steering Docs**: [../.kiro/steering/](../.kiro/steering/)
- **Source Code**: [../client/](../client/) and [../service/](../service/)

---

## Contributing

When updating documentation:
1. Keep examples up-to-date with actual implementation
2. Include request/response examples for all endpoints
3. Document error cases and edge cases
4. Update this README when adding new docs
5. Cross-reference related documentation

---

## Questions?

For implementation questions, refer to:
- **Client code**: `client/src/services/gameWebSocket.ts` and `client/src/services/dailyChallengeApi.ts`
- **Server code**: `service/lambda/websocket/` and `service/lambda/rest/`
- **Steering docs**: `.kiro/steering/GAMEPLAY.md` and `.kiro/steering/TECHNICAL_CONSTRAINTS.md`
