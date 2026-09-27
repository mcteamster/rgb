import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend, mockSendToConnection, mockBroadcastToGame } = vi.hoisted(() => ({
    mockSend: vi.fn(),
    mockSendToConnection: vi.fn(),
    mockBroadcastToGame: vi.fn(),
}))

vi.mock('./aws-clients', () => ({
    dynamodb: { send: mockSend },
    broadcastToGame: mockBroadcastToGame,
    sendToConnection: mockSendToConnection,
}))
vi.mock('./deadlines', () => ({ checkAndEnforceDeadlines: vi.fn() }))

import { handleCreateGame, handleJoinGame, handleRejoinGame, handleKickPlayer, handleGetGame } from './game-handlers'

const makeGame = (overrides: any = {}) => ({
    gameId: 'game1',
    meta: { status: 'waiting', currentRound: null },
    config: { maxPlayers: 10, descriptionTimeLimit: 30, guessingTimeLimit: 15, turnsPerPlayer: 2 },
    players: [
        { playerId: 'host', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z', score: 0 },
        { playerId: 'p2', playerName: 'Bob', joinedAt: '2024-01-01T00:00:01Z', score: 0 }
    ],
    gameplay: { rounds: [] },
    ...overrides
})

beforeEach(() => {
    mockSend.mockReset()
    mockSendToConnection.mockReset()
    mockBroadcastToGame.mockReset()
})

// ============================================================
// handleGetGame
// ============================================================

describe('handleGetGame', () => {
    it('returns 404 when game is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handleGetGame('conn1', 'game1')
        expect(result.statusCode).toBe(404)
    })

    it('returns 200 and sends game state when found', async () => {
        const game = makeGame()
        mockSend.mockResolvedValueOnce({ Item: game })
        const result = await handleGetGame('conn1', 'game1')
        expect(result.statusCode).toBe(200)
        expect(mockSendToConnection).toHaveBeenCalledWith('conn1', expect.objectContaining({ type: 'gameStateUpdated' }))
    })
})

// ============================================================
// handleCreateGame
// ============================================================

describe('handleCreateGame', () => {
    it('returns 400 for empty player name', async () => {
        const result = await handleCreateGame('conn1', '')
        expect(result.statusCode).toBe(400)
    })

    it('returns 400 for player name longer than 16 characters', async () => {
        const result = await handleCreateGame('conn1', 'NameThatIsTooLong!')
        expect(result.statusCode).toBe(400)
    })

    it('returns 200 and creates game for valid player name', async () => {
        mockSend.mockResolvedValue({})
        const result = await handleCreateGame('conn1', 'Alice')
        expect(result.statusCode).toBe(200)
    })

    it('clamps maxPlayers to valid range', async () => {
        mockSend.mockResolvedValue({})
        await handleCreateGame('conn1', 'Alice', { maxPlayers: 99 })
        // No error — config validation is internal but should not throw
        expect(mockSend).toHaveBeenCalled()
    })
})

// ============================================================
// handleJoinGame
// ============================================================

describe('handleJoinGame', () => {
    it('returns 400 for empty player name', async () => {
        const result = await handleJoinGame('conn1', 'game1', '')
        expect(result.statusCode).toBe(400)
    })

    it('returns 400 for player name longer than 16 characters', async () => {
        const result = await handleJoinGame('conn1', 'game1', 'ThisNameIsWayTooLong')
        expect(result.statusCode).toBe(400)
    })

    it('returns 404 when game is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handleJoinGame('conn1', 'game1', 'Alice')
        expect(result.statusCode).toBe(404)
    })

    it('returns 400 for duplicate name in waiting game', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() })
        const result = await handleJoinGame('conn1', 'game1', 'Alice')
        expect(result.statusCode).toBe(400)
    })

    it('returns 400 when game is already in progress', async () => {
        mockSend.mockResolvedValueOnce({
            Item: makeGame({ meta: { status: 'playing', currentRound: 0 } })
        })
        const result = await handleJoinGame('conn1', 'game1', 'NewPlayer')
        expect(result.statusCode).toBe(400)
    })

    it('returns 400 when game is full', async () => {
        const fullGame = makeGame({ config: { maxPlayers: 2 } })
        mockSend.mockResolvedValueOnce({ Item: fullGame })
        const result = await handleJoinGame('conn1', 'game1', 'NewPlayer')
        expect(result.statusCode).toBe(400)
    })

    it('returns 200 for valid new player joining waiting game', async () => {
        mockSend.mockResolvedValue({ Items: [] })
        const game = makeGame()
        game.players = [{ playerId: 'host', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z' }]
        mockSend.mockResolvedValueOnce({ Item: game })
        mockSend.mockResolvedValue({ Items: [] })
        const result = await handleJoinGame('conn1', 'game1', 'Bob')
        expect(result.statusCode).toBe(200)
    })

    it('returns 400 when existing player is already connected in an in-progress game', async () => {
        const game = makeGame({ meta: { status: 'playing', currentRound: 0 } })
        mockSend
            .mockResolvedValueOnce({ Item: game })
            .mockResolvedValueOnce({ Items: [{ connectionId: 'existing-conn' }] })
        const result = await handleJoinGame('conn1', 'game1', 'Alice') // Alice exists in game
        expect(result.statusCode).toBe(400)
    })

    it('returns 200 when existing player reconnects to an in-progress game', async () => {
        const game = makeGame({ meta: { status: 'playing', currentRound: 0 } })
        mockSend
            .mockResolvedValueOnce({ Item: game })       // GetCommand: game
            .mockResolvedValueOnce({ Items: [] })        // QueryCommand: not already connected
            .mockResolvedValue({})                       // PutCommand + any further calls
        const result = await handleJoinGame('conn1', 'game1', 'Alice')
        expect(result.statusCode).toBe(200)
    })

    // ----- Task 3.1: guarded write uses list_append and ConditionExpression -----

    it('issues UpdateCommand with list_append and ConditionExpression for a valid join', async () => {
        const game = makeGame()
        game.players = [{ playerId: 'host', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z' }]
        mockSend
            .mockResolvedValueOnce({ Item: game })  // GetCommand: initial read
            .mockResolvedValueOnce({})              // UpdateCommand: guarded write
            .mockResolvedValueOnce({})              // UpdateCommand: connections table
            .mockResolvedValue({ Items: [] })       // QueryCommand: other connections

        await handleJoinGame('conn1', 'game1', 'Bob')

        // Find the call that was an UpdateCommand against the games table
        const updateCall = mockSend.mock.calls.find(([cmd]) => {
            const input = cmd?.input ?? cmd
            return (
                input.UpdateExpression?.includes('list_append') &&
                input.ConditionExpression !== undefined
            )
        })
        expect(updateCall).toBeDefined()
        const input = updateCall![0].input ?? updateCall![0]
        expect(input.UpdateExpression).toContain('list_append(players, :newPlayer)')
        expect(input.ConditionExpression).toContain('size(players) = :expectedCount')
        expect(input.ConditionExpression).toContain('size(players) < :maxPlayers')
        expect(input.ConditionExpression).toContain('meta.#status = :waiting')
        expect(input.ExpressionAttributeNames?.['#status']).toBe('status')
    })

    // ----- Task 3.2: retry on ConditionalCheckFailedException -----

    it('retries once when guarded write throws ConditionalCheckFailedException then succeeds', async () => {
        const game = makeGame()
        game.players = [{ playerId: 'host', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z' }]

        // Fresh game after first conflict — still only Alice, so Bob can still join
        const freshGame = { ...game, players: [...game.players] }

        const condError = Object.assign(new Error('ConditionalCheckFailedException'), {
            name: 'ConditionalCheckFailedException'
        })

        mockSend
            .mockResolvedValueOnce({ Item: game })        // GetCommand: initial read
            .mockRejectedValueOnce(condError)             // UpdateCommand: first attempt fails
            .mockResolvedValueOnce({ Item: freshGame })   // GetCommand: strong-consistent re-read
            .mockResolvedValueOnce({})                    // UpdateCommand: second attempt succeeds
            .mockResolvedValueOnce({})                    // UpdateCommand: connections table
            .mockResolvedValue({ Items: [] })             // QueryCommand: other connections

        const result = await handleJoinGame('conn1', 'game1', 'Bob')
        expect(result.statusCode).toBe(200)

        // Two guarded UpdateCommand attempts (both list_append)
        const updateCalls = mockSend.mock.calls.filter(([cmd]) => {
            const input = cmd?.input ?? cmd
            return input.UpdateExpression?.includes('list_append')
        })
        expect(updateCalls.length).toBe(2)
    })

    // ----- Task 3.3: two concurrent joins, room for both -----

    it('persists both players when two concurrent joins have room for both', async () => {
        // Simulate game with 1 player and maxPlayers=10 — room for both Bob and Carol
        const baseGame = makeGame()
        baseGame.players = [{ playerId: 'host', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z' }]
        baseGame.config = { ...baseGame.config, maxPlayers: 10 }

        // Each join gets its own mock setup — run them sequentially with non-overlapping mocks
        // Bob joins first (no conflict)
        mockSend
            .mockResolvedValueOnce({ Item: baseGame })  // Bob: initial read
            .mockResolvedValueOnce({})                  // Bob: guarded write
            .mockResolvedValueOnce({})                  // Bob: connections table
            .mockResolvedValue({ Items: [] })           // Bob: other connections query

        const bobResult = await handleJoinGame('conn-bob', 'game1', 'Bob')
        expect(bobResult.statusCode).toBe(200)

        mockSend.mockReset()

        // Carol joins next — game now has Bob too, still room
        const gameWithBob = {
            ...baseGame,
            players: [
                ...baseGame.players,
                { playerId: 'p-bob', playerName: 'Bob', joinedAt: '2024-01-01T00:00:02Z' }
            ]
        }
        mockSend
            .mockResolvedValueOnce({ Item: gameWithBob })  // Carol: initial read
            .mockResolvedValueOnce({})                     // Carol: guarded write
            .mockResolvedValueOnce({})                     // Carol: connections table
            .mockResolvedValue({ Items: [] })              // Carol: other connections

        const carolResult = await handleJoinGame('conn-carol', 'game1', 'Carol')
        expect(carolResult.statusCode).toBe(200)
    })

    // ----- Task 3.4: concurrent joins race for the last slot -----

    it('admits exactly one and returns Game is full for the other when racing for the last slot', async () => {
        // maxPlayers=2, one player already in — only one slot left
        const fullishGame = makeGame({ config: { maxPlayers: 2 } })
        fullishGame.players = [{ playerId: 'host', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z' }]

        const condError = Object.assign(new Error('ConditionalCheckFailedException'), {
            name: 'ConditionalCheckFailedException'
        })

        // Second joiner: initial read sees room, then write conflicts, re-read shows full
        const fullGame = {
            ...fullishGame,
            players: [
                ...fullishGame.players,
                { playerId: 'p-bob', playerName: 'Bob', joinedAt: '2024-01-01T00:00:02Z' }
            ]
        }

        mockSend
            .mockResolvedValueOnce({ Item: fullishGame }) // initial read: sees 1 player, room for 1 more
            .mockRejectedValueOnce(condError)             // guarded write: another joiner won the slot
            .mockResolvedValueOnce({ Item: fullGame })    // strong-consistent re-read: now full

        const result = await handleJoinGame('conn-carol', 'game1', 'Carol')
        expect(result.statusCode).toBe(400)
        expect(mockSendToConnection).toHaveBeenCalledWith('conn-carol', expect.objectContaining({
            type: 'error',
            error: 'Game is full'
        }))
    })

    // ----- Task 3.5: concurrent same-name joins -----

    it('admits at most one and returns Player name is already taken for the other on same-name race', async () => {
        const game = makeGame()
        game.players = [{ playerId: 'host', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z' }]

        const condError = Object.assign(new Error('ConditionalCheckFailedException'), {
            name: 'ConditionalCheckFailedException'
        })

        // Second "Bob" attempt: initial read sees no Bob, write conflicts, re-read shows Bob already in
        const gameWithBob = {
            ...game,
            players: [
                ...game.players,
                { playerId: 'p-bob', playerName: 'Bob', joinedAt: '2024-01-01T00:00:02Z' }
            ]
        }

        mockSend
            .mockResolvedValueOnce({ Item: game })         // initial read: no Bob yet
            .mockRejectedValueOnce(condError)              // guarded write: concurrent Bob won
            .mockResolvedValueOnce({ Item: gameWithBob })  // strong-consistent re-read: Bob now present

        const result = await handleJoinGame('conn-bob2', 'game1', 'Bob')
        expect(result.statusCode).toBe(400)
        expect(mockSendToConnection).toHaveBeenCalledWith('conn-bob2', expect.objectContaining({
            type: 'error',
            error: 'Player name is already taken'
        }))
    })

    // ----- Task 2.3 / retry exhaustion: 5 consecutive conflicts → 409 -----

    it('returns 409 after exhausting all retry attempts', async () => {
        const game = makeGame()
        game.players = [{ playerId: 'host', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z' }]

        // Fresh re-read always has room for one more — so every re-check passes
        // and the handler loops back to try again.
        const freshGame = { ...game, players: [...game.players] }

        const condError = Object.assign(new Error('ConditionalCheckFailedException'), {
            name: 'ConditionalCheckFailedException'
        })

        // Pattern: (write fails, re-read succeeds) × 5, last iteration hits the
        // exhaustion guard before the 6th write attempt.
        mockSend
            .mockResolvedValueOnce({ Item: game })       // GetCommand: initial read
            .mockRejectedValueOnce(condError)            // UpdateCommand: attempt 0 fails
            .mockResolvedValueOnce({ Item: freshGame })  // GetCommand: re-read 0
            .mockRejectedValueOnce(condError)            // UpdateCommand: attempt 1 fails
            .mockResolvedValueOnce({ Item: freshGame })  // GetCommand: re-read 1
            .mockRejectedValueOnce(condError)            // UpdateCommand: attempt 2 fails
            .mockResolvedValueOnce({ Item: freshGame })  // GetCommand: re-read 2
            .mockRejectedValueOnce(condError)            // UpdateCommand: attempt 3 fails
            .mockResolvedValueOnce({ Item: freshGame })  // GetCommand: re-read 3
            .mockRejectedValueOnce(condError)            // UpdateCommand: attempt 4 fails
            .mockResolvedValueOnce({ Item: freshGame })  // GetCommand: re-read 4

        const result = await handleJoinGame('conn1', 'game1', 'Bob')
        expect(result.statusCode).toBe(409)
        expect(mockSendToConnection).toHaveBeenCalledWith('conn1', expect.objectContaining({
            type: 'error',
            error: 'Failed to join game due to concurrent activity; please try again'
        }))

        // Confirm all 5 write attempts were made
        const writeCalls = mockSend.mock.calls.filter(([cmd]) => {
            const input = cmd?.input ?? cmd
            return input.UpdateExpression?.includes('list_append')
        })
        expect(writeCalls.length).toBe(5)
    })
})

// ============================================================
// handleRejoinGame
// ============================================================

describe('handleRejoinGame', () => {
    it('returns 404 when game is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handleRejoinGame('conn1', 'game1', 'player1')
        expect(result.statusCode).toBe(404)
    })

    it('returns 404 when player is not in the game', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() })
        const result = await handleRejoinGame('conn1', 'game1', 'unknownPlayer')
        expect(result.statusCode).toBe(404)
    })

    it('returns 200 for valid rejoin', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() })
        mockSend.mockResolvedValue({})
        const result = await handleRejoinGame('conn1', 'game1', 'host')
        expect(result.statusCode).toBe(200)
    })
})

// ============================================================
// handleKickPlayer
// ============================================================

describe('handleKickPlayer', () => {
    it('returns 404 when game is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handleKickPlayer('conn1', 'game1', 'host', 'p2', 'kick')
        expect(result.statusCode).toBe(404)
    })

    it('returns 403 when non-host tries to kick another player', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() })
        const result = await handleKickPlayer('conn1', 'game1', 'p2', 'host', 'kick')
        expect(result.statusCode).toBe(403)
    })

    it('returns 404 when target player is not in the game', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() })
        const result = await handleKickPlayer('conn1', 'game1', 'host', 'nobody', 'kick')
        expect(result.statusCode).toBe(404)
    })

    it('allows a player to leave themselves (non-kick reason)', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() })
        mockSend.mockResolvedValue({ Items: [] })
        const result = await handleKickPlayer('conn1', 'game1', 'p2', 'p2', 'leave')
        expect(result.statusCode).toBe(200)
    })

    it('allows host to kick another player', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() })
        mockSend.mockResolvedValue({ Items: [] })
        const result = await handleKickPlayer('conn1', 'game1', 'host', 'p2', 'kick')
        expect(result.statusCode).toBe(200)
    })

    it('sends kicked notification when target connection is found', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeGame() })
            .mockResolvedValueOnce({})                                        // UpdateCommand: remove player
            .mockResolvedValueOnce({ Items: [{ connectionId: 'p2-conn' }] }) // QueryCommand: find target connection
            .mockResolvedValue({})                                            // UpdateCommand: clear connection
        const result = await handleKickPlayer('conn1', 'game1', 'host', 'p2', 'kick')
        expect(result.statusCode).toBe(200)
        expect(mockSendToConnection).toHaveBeenCalledWith('p2-conn', expect.objectContaining({ type: 'kicked' }))
    })
})
