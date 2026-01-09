# Client-Server Communication Documentation

## Overview

RGB uses WebSocket communication for real-time multiplayer gameplay. The client establishes a persistent WebSocket connection to the server and exchanges JSON messages for all game interactions.

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
Creates a new game room and joins the creator as the first player.
```typescript
{
  action: 'createGame',
  playerName: string,
  config?: {
    maxPlayers?: number,           // Default: 10
    descriptionTimeLimit?: number, // Seconds, 0 = no limit
    guessingTimeLimit?: number     // Seconds, 0 = no limit
  }
}
```

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
Starts a new round (host only).
```typescript
{
  action: 'startRound',
  gameId: string,
  playerId: string
}
```

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
