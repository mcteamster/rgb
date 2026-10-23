# Disconnect Grace Period

Holds a disconnected player's game slot for a configurable window so that transient network interruptions can self-heal without permanently disrupting the lobby or active round.

## Requirement: Grace period on disconnect

When a player's WebSocket connection closes, the server SHALL mark the connection record with a `gracePeriodExpiresAt` timestamp instead of immediately removing the player from the game. The duration SHALL be controlled by the `DISCONNECT_GRACE_PERIOD_SECONDS` environment variable (default `30`). When `DISCONNECT_GRACE_PERIOD_SECONDS` is `0` the server SHALL remove the player immediately (no grace period).

### Scenario: Player disconnects during active game with grace period enabled

- **WHEN** a player's WebSocket connection closes and `DISCONNECT_GRACE_PERIOD_SECONDS` is greater than `0`
- **THEN** the server writes `gracePeriodExpiresAt` to the connection record set to `now + DISCONNECT_GRACE_PERIOD_SECONDS`
- **THEN** the player is NOT removed from the game's player list
- **THEN** no `playersUpdated` broadcast is sent to other players at disconnect time

### Scenario: Grace period disabled — immediate removal

- **WHEN** a player's WebSocket connection closes and `DISCONNECT_GRACE_PERIOD_SECONDS` is `0`
- **THEN** the server immediately removes the player from the game (existing kick/disconnect behavior)

### Scenario: Player disconnects from waiting lobby

- **WHEN** a player in a waiting-status game disconnects and `DISCONNECT_GRACE_PERIOD_SECONDS` is greater than `0`
- **THEN** the server marks the connection with `gracePeriodExpiresAt` and does NOT remove the player from the lobby

## Requirement: Expired grace period triggers permanent removal

A sweeper process SHALL periodically scan all connection records whose `gracePeriodExpiresAt` is in the past and permanently remove those players from their games.

### Scenario: Sweeper evicts expired disconnected player

- **WHEN** a connection record has `gracePeriodExpiresAt` set and that timestamp is before the current time
- **THEN** the sweeper removes the player from the game using the existing kick/disconnect logic
- **THEN** the sweeper deletes the connection record
- **THEN** remaining players receive a `playersUpdated` broadcast

### Scenario: Sweeper runs on a regular schedule

- **WHEN** the sweeper executes
- **THEN** it processes all expired grace-period connection records in one invocation
- **THEN** it does not process connection records that are still within their grace window

### Scenario: Sweeper encounters a player who reconnected

- **WHEN** the sweeper checks a connection record for a player who has already reconnected
- **THEN** the reconnected connection record has no `gracePeriodExpiresAt` attribute
- **THEN** the sweeper skips that record and does not remove the player

## Requirement: Reconnect within grace period cancels eviction

If a player reconnects (via `rejoinGame`) before their grace period expires, the server SHALL clear the `gracePeriodExpiresAt` marker on the new connection record and restore the player to their game without broadcasting a leave or rejoin event to other players.

### Scenario: Player reconnects before grace period expires

- **WHEN** a player sends a `rejoinGame` action within the grace window
- **THEN** the server associates the new connection with the existing game and player
- **THEN** the new connection record does NOT have `gracePeriodExpiresAt` set
- **THEN** no `playersUpdated` broadcast is sent (the player was never removed)
- **THEN** the server sends a `gameStateUpdated` event to the reconnecting player

### Scenario: Player tries to rejoin after grace period has expired and been swept

- **WHEN** a player sends `rejoinGame` after the sweeper has already removed them
- **THEN** the server returns an error `'Player not found in game'`

## Requirement: Grace period is invisible to other players during the window

While a player is within their grace period, the game state visible to other players SHALL show the player as still present with their current score and data.

### Scenario: Other players poll game state during grace period

- **WHEN** any player requests the current game state while a disconnected player is within their grace window
- **THEN** the returned `players` list still includes the disconnected player
- **THEN** the disconnected player's game slot and data are intact

### Scenario: Round continues during grace period

- **WHEN** the active round requires all players to submit (guessing phase) and one player is in their grace period
- **THEN** the round does not auto-resolve solely because of the grace-period player's absence
- **THEN** the sweeper's eviction, when it fires, triggers the same downstream logic as an in-round kick (existing guessing-phase kick behavior applies)
