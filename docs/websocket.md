# WebSocket API Documentation - Multiplayer

## Overview

RGB uses WebSocket communication for real-time multiplayer gameplay. The client establishes a persistent WebSocket connection to the server and exchanges JSON messages for all game interactions.

**WebSocket URL**: `wss://ws.rgb.mcteamster.com` (production)

**Regional Endpoints**: Game codes encode the AWS region for optimal latency (see Regional Game Codes section)

## Connection Architecture

### Client Side
- **WebSocket Client**: `GameWebSocket` class in `client/src/services/gameWebSocket.ts`
- **Auto-reconnection**: Exponential backoff with max 5 attempts
- **Regional endpoints**: Auto-detects closest AWS region for optimal latency
- **Message queuing**: Queues messages during connection/reconnection
- **Sync polling**: Polls game state every 5 seconds when in a game

### Server Side
- **AWS API Gateway WebSocket API**: Manages connections and routing
- **Lambda handlers**: Process messages in `service/lambda/websocket/`
- **DynamoDB**: Stores game state and connection mappings
- **Broadcasting**: Sends messages to all players in a game room
- **Deadline Enforcement**: Automatic phase transitions when time limits expire

## Message Structure

### Client to Server (Actions)
```typescript
interface WebSocketMessage {
  action: string;           // Action type
  gameId?: string;         // Game room identifier
  playerId?: string;       // Player identifier
  playerName?: string;     // Player display name
  config?: GameConfig;     // Game configuration (create only)
  data?: {                 // Action-specific data
    color?: HSLColor;
    description?: string;
    targetPlayerId?: string;
  };
}
```

### Server to Client (Events)
```typescript
interface GameEvent {
  type: string;            // Event type
  gameId?: string;         // Game room identifier
  playerId?: string;       // Player identifier
  error?: string;          // Error message
  message?: string;        // Info message
  gameState?: GameState;   // Complete game state
  meta?: GameMeta;         // Game metadata only
  players?: Player[];      // Players list only
  gameplay?: GameplayData; // Gameplay data only
}
```

## Client Actions (Outbound)

### Game Management

#### `createGame`
Creates a new game room and joins the creator as the first player. The creator becomes the host.

**Request**:
```typescript
{
  action: 'createGame',
  playerName: string,        // 1-16 characters
  config?: {
    maxPlayers?: number,           // 2-10, default: 10
    descriptionTimeLimit?: number, // 10-86400 seconds or 0 for unlimited, default: 30
    guessingTimeLimit?: number,    // 5-86400 seconds or 0 for unlimited, default: 15
    turnsPerPlayer?: number        // 1-5, default: 2
  }
}
```

**Response Event**: `gameStateUpdated` with full game state and your `playerId`

**Notes**:
- Host is always the earliest-joined player
- Only host can start rounds and kick players
- Game code encodes the AWS region (see Regional Game Codes)

#### `joinGame`
Joins an existing game room.
```typescript
{
  action: 'joinGame',
  gameId: string,
  playerName: string
}
```

#### `rejoinGame`
Reconnects to a game after disconnection using stored session.
```typescript
{
  action: 'rejoinGame',
  gameId: string,
  playerId: string
}
```

#### `getGame`
Requests current game state (used for sync polling).
```typescript
{
  action: 'getGame',
  gameId: string,
  playerId?: string
}
```

#### `kickPlayer`
Removes a player from the game (or leaves if targeting self).
```typescript
{
  action: 'kickPlayer',
  gameId: string,
  playerId: string,
  data: {
    targetPlayerId: string
  }
}
```

### Round Management

#### `startRound`
Starts a new round. Only the host can start from waiting state. Any player can start subsequent rounds from reveal state.

**Request**:
```typescript
{
  action: 'startRound',
  gameId: string,
  playerId: string
}
```

**Response Events**: 
- `metaUpdated` - Status changes to 'playing'
- `gameplayUpdated` - New round added with describer and target color

**Describer Selection Algorithm**:
1. Tracks how many times each player has been describer
2. Selects from players with minimum clue count
3. Among eligible, chooses who gave clue longest ago
4. Avoids back-to-back selection when possible
5. First round only: random selection among eligible

**Notes**:
- Requires minimum 2 players
- Game ends when all players complete `turnsPerPlayer` turns as describer
- Target color generated with H: 0-360°, S: 20-100%, L: 15-85%

#### `finaliseGame`
Ends the current game and shows final scores.
```typescript
{
  action: 'finaliseGame',
  gameId: string,
  playerId: string
}
```

#### `resetGame`
Resets game to waiting state, clearing all rounds and scores.
```typescript
{
  action: 'resetGame',
  gameId: string,
  playerId: string
}
```

#### `closeRoom`
Closes the game room and kicks all players.
```typescript
{
  action: 'closeRoom',
  gameId: string,
  playerId: string
}
```

### Gameplay Actions

#### `updateDraftDescription`
Updates the describer's draft description (real-time preview).
```typescript
{
  action: 'updateDraftDescription',
  gameId: string,
  playerId: string,
  data: {
    description: string
  }
}
```

#### `submitDescription`
Submits the final description and transitions to guessing phase.
```typescript
{
  action: 'submitDescription',
  gameId: string,
  playerId: string,
  data: {
    description: string
  }
}
```

#### `updateDraftColor`
Updates a player's draft color guess (real-time preview).
```typescript
{
  action: 'updateDraftColor',
  gameId: string,
  playerId: string,
  data: {
    color: HSLColor  // { h: 0-360, s: 0-100, l: 0-100 }
  }
}
```

#### `submitColor`
Submits the final color guess.
```typescript
{
  action: 'submitColor',
  gameId: string,
  playerId: string,
  data: {
    color: HSLColor
  }
}
```

## Server Events (Inbound)

### Game State Events

#### `gameStateUpdated`
Complete game state update, sent after major state changes.
```typescript
{
  type: 'gameStateUpdated',
  gameId: string,
  playerId?: string,  // Set when player joins/creates
  gameState: {
    gameId: string,
    config: GameConfig,
    meta: {
      status: 'waiting' | 'playing' | 'finished',
      currentRound: number | null,
      createdAt: string
    },
    players: Player[],
    gameplay: {
      rounds: GameRound[]
    }
  }
}
```

#### `metaUpdated`
Game metadata changes (status, current round).
```typescript
{
  type: 'metaUpdated',
  meta: {
    status: 'waiting' | 'playing' | 'finished',
    currentRound: number | null,
    createdAt: string
  }
}
```

#### `playersUpdated`
Player list changes (join, leave, score updates).
```typescript
{
  type: 'playersUpdated',
  players: Player[]
}
```

#### `gameplayUpdated`
Round data changes (new rounds, submissions, scores).
```typescript
{
  type: 'gameplayUpdated',
  gameplay: {
    rounds: GameRound[]
  }
}
```

### Error and Status Events

#### `error`
Error response for failed actions.
```typescript
{
  type: 'error',
  error: string,
  message?: string
}
```

#### `kicked`
Player was removed from the game.
```typescript
{
  type: 'kicked',
  message: string
}
```

#### `connectionStatus`
Connection state changes (client-side only).
```typescript
{
  type: 'connectionStatus',
  status: 'connected' | 'disconnected'
}
```

## Game Flow Communication

### 1. Game Creation/Joining
```
Client → Server: createGame/joinGame
Server → Client: gameStateUpdated (with playerId)
Server → All: playersUpdated
```

### 2. Starting a Round
```
Client → Server: startRound
Server → All: metaUpdated (status: 'playing')
Server → All: gameplayUpdated (new round with target color)
```

### 3. Description Phase
```
Client → Server: updateDraftDescription (real-time)
Client → Server: submitDescription
Server → All: gameplayUpdated (description added)
Server → All: metaUpdated (phase transition)
```

### 4. Guessing Phase
```
Client → Server: updateDraftColor (real-time)
Client → Server: submitColor
Server → All: playersUpdated (draft colors visible)
Server → All: gameplayUpdated (final submissions)
```

### 5. Round End/Scoring
```
Server → All: gameplayUpdated (scores calculated)
Server → All: playersUpdated (total scores updated)
Server → All: metaUpdated (next round or game end)
```

## Real-time Features

### Draft Updates
- **Description drafts**: `updateDraftDescription` shows live typing
- **Color drafts**: `updateDraftColor` shows live color selection
- **Visibility**: Other players see drafts in real-time during appropriate phases

### Automatic Sync
- **Polling**: Client polls `getGame` every 5 seconds when in a game
- **Reconnection**: Automatic rejoin on connection restore
- **State consistency**: Server authoritative, client syncs regularly

### Deadline Enforcement
- **Server-side timers**: Automatic phase transitions when time limits expire
- **Grace period**: Brief buffer for network latency
- **Timeout handling**: Draft submissions used if no final submission

## Error Handling

### Connection Errors
- **Reconnection**: Exponential backoff (1s, 2s, 4s, 8s, 16s, 30s max)
- **Message queuing**: Queues messages during reconnection
- **Session restore**: Automatic rejoin with stored gameId/playerId

### Validation Errors
- **Player authorization**: Validates player belongs to game
- **Game state**: Validates actions are valid for current game phase
- **Input validation**: Server-side validation of all inputs

### Network Resilience
- **Stale connections**: Server detects and cleans up dead connections
- **Duplicate messages**: Idempotent operations where possible
- **Race conditions**: DynamoDB conditional updates prevent conflicts

## Security Considerations

### Input Validation
- **Color bounds**: HSL values validated (H: 0-360°, S/L: 0-100%)
- **String limits**: Description length limits enforced
- **Rate limiting**: Prevents spam and automation

### Game Integrity
- **Server authority**: All game logic runs server-side
- **Player verification**: Actions validated against player session
- **Timing enforcement**: Server-controlled phase transitions
- **Score calculation**: Server-only, prevents tampering

### Connection Security
- **HTTPS/WSS only**: All communication encrypted
- **CORS validation**: Strict origin checking
- **Connection cleanup**: Automatic cleanup of stale connections

## Scoring System

RGB uses **two different scoring algorithms** depending on the game mode:

### Multiplayer - Geometric Normal Distribution

Used for real-time multiplayer games where players guess a fixed target color.

**Key Points**:
- **Algorithm**: Weighted geometric mean of normal distribution components
- **Weights**: Hue (6.0), Saturation (1.0), Lightness (2.0)
- **3-Sigma Cutoff**: Guesses beyond 3 standard deviations score 0 points
- **Dynamic Adjustments**: Hue and lightness tolerances adjust based on target color
- **Describer Bonus**: Receives average of all guesser scores (rounded)

### Daily Challenge - Bicone Distance

Used for daily challenges where players are scored against the community average.

**Key Points**:
- **Algorithm**: Euclidean distance in bicone Cartesian space
- **Space**: Converts HSL to 3D coordinates (x, y, z)
- **Scoring**: `100 × (1 - distance/maxDistance)` where maxDistance ≈ √2
- **Average**: Calculated using Welford's algorithm for efficient updates
- **Linear Scaling**: Closer to average = higher score (no cutoff)

See [hsl-color-scoring.md](./hsl-color-scoring.md) for detailed algorithm documentation and examples.

### Special Scoring Cases

**No Clue Provided**:
- If describer times out without providing a description (or submits `<NO CLUE>`)
- All guessers receive +100 points
- Describer receives 0 points
- Round immediately transitions to reveal phase

**Timeout with Draft**:
- If a player doesn't submit but has a draft color
- Draft color is automatically submitted and scored normally
- Applies to both description and guessing phases

## Regional Game Codes

Game IDs are 4-character codes that encode the AWS region for latency awareness.

### Format
- **3 random characters** + **1 region indicator**
- Example: `XYZS` = game in US East region

### Region Encoding
| Code | Region | AWS Region |
|------|--------|------------|
| BC | Australia 🇦🇺 | ap-southeast-2 |
| DF | Japan 🇯🇵 | ap-northeast-1 |
| GH | Singapore 🇸🇬 | ap-southeast-1 |
| JK | India 🇮🇳 | ap-south-1 |
| LM | Europe 🇪🇺 | eu-central-1 |
| NP | UK 🇬🇧 | eu-west-2 |
| QR | Brazil 🇧🇷 | sa-east-1 |
| ST | US East 🇺🇸 | us-east-1 |
| VW | US West 🇺🇸 | us-west-2 |
| XZ | Local/Fallback | - |

### Purpose
- Players can identify server location from game code
- Helps players choose games with lower latency
- Regional endpoints automatically selected by client

## Game Lifecycle

### Waiting State
- Game created, players can join
- Host can configure settings
- Minimum 2 players required to start
- Host starts game via `startRound`

### Playing State
- Rounds progress through phases: Description → Guessing → Reveal
- Automatic phase transitions based on time limits
- Manual progression from reveal to next round
- Game continues until all players complete `turnsPerPlayer` turns

### Endgame State
- Triggered when all players have been describer `turnsPerPlayer` times
- Final leaderboard displayed
- Host can reset game or close room

### Game End
- Host can reset game (returns to waiting state)
- Host can close room (deletes game)
- Inactive games automatically cleaned up after 12 hours

## Best Practices

### Client Implementation
- Always handle reconnection gracefully
- Store gameId/playerId in localStorage for rejoin
- Poll game state regularly for sync
- Show loading states during network operations
- Handle all error events appropriately

### Performance
- Debounce draft updates (max 1 per 100ms)
- Use WebSocket for real-time, not REST API
- Cache game state locally, sync periodically
- Minimize message size where possible

### User Experience
- Show connection status clearly
- Display time remaining for phases
- Indicate when other players are typing/selecting
- Provide feedback for all actions
- Handle edge cases (disconnects, kicks, etc.)
