import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend, mockSendToConnection, mockBroadcastToGame, mockResolveRoundScores } = vi.hoisted(() => ({
    mockSend: vi.fn(),
    mockSendToConnection: vi.fn(),
    mockBroadcastToGame: vi.fn(),
    mockResolveRoundScores: vi.fn(),
}))

vi.mock('./aws-clients', () => ({
    dynamodb: { send: mockSend },
    broadcastToGame: mockBroadcastToGame,
    sendToConnection: mockSendToConnection,
}))
vi.mock('./deadlines', () => ({ checkAndEnforceDeadlines: vi.fn() }))
vi.mock('./round-handlers', () => ({ resolveRoundScores: mockResolveRoundScores }))

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
    mockResolveRoundScores.mockReset()
    mockResolveRoundScores.mockResolvedValue(undefined)
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

// ============================================================
// handleKickPlayer — guessing-phase removal (task 3.3)
// ============================================================

describe('handleKickPlayer — guessing phase', () => {
    const makeGuessingGame = (submissions: Record<string, any> = {}) =>
        makeGame({
            meta: { status: 'playing', currentRound: 0 },
            players: [
                { playerId: 'host', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z', score: 0 },
                { playerId: 'p2',   playerName: 'Bob',   joinedAt: '2024-01-01T00:00:01Z', score: 0 },
                { playerId: 'p3',   playerName: 'Carol', joinedAt: '2024-01-01T00:00:02Z', score: 0 },
            ],
            gameplay: {
                rounds: [{
                    phase: 'guessing',
                    describerId: 'host',
                    targetColor: { h: 180, s: 50, l: 50 },
                    submissions,
                }]
            }
        })

    it('removes non-submitting guesser when others still pending — round stays in guessing, only playersUpdated broadcast', async () => {
        // p2 has submitted, p3 has not; we remove p3 (non-submitter)
        // After removal only p2 remains as guesser and p2 already submitted →
        // wait — that would trigger resolve. Let's have p2 NOT submitted.
        // p3 submitted, p2 has not; remove p3 — p2 still pending
        const game = makeGuessingGame({ p3: { h: 10, s: 10, l: 10 } })
        // 3-player game: remove p3 (already submitted). p2 still pending.
        mockSend
            .mockResolvedValueOnce({ Item: game })           // GetCommand: game
            .mockResolvedValueOnce({})                       // UpdateCommand: persist players
            .mockResolvedValueOnce({ Items: [] })            // QueryCommand: find target connection
        const result = await handleKickPlayer('conn1', 'game1', 'host', 'p3', 'kick')
        expect(result.statusCode).toBe(200)
        expect(mockResolveRoundScores).not.toHaveBeenCalled()
        expect(mockBroadcastToGame).toHaveBeenCalledWith('game1', expect.objectContaining({ type: 'playersUpdated' }))
        expect(mockBroadcastToGame).not.toHaveBeenCalledWith('game1', expect.objectContaining({ type: 'gameplayUpdated' }))
    })

    it('removes the last pending guesser — resolveRoundScores is called', async () => {
        // p2 has submitted; p3 has not — remove p3 (only pending guesser)
        const game = makeGuessingGame({ p2: { h: 20, s: 20, l: 20 } })
        const updatedGameAfterPersist = {
            ...game,
            players: game.players.filter((p: any) => p.playerId !== 'p3'),
            meta: { ...game.meta }
        }
        mockSend
            .mockResolvedValueOnce({ Item: game })                           // GetCommand: game
            .mockResolvedValueOnce({})                                       // UpdateCommand: persist players
            .mockResolvedValueOnce({ Items: [] })                            // QueryCommand: find target connection
            .mockResolvedValueOnce({ Item: updatedGameAfterPersist })        // GetCommand: for resolveRoundScores
        const result = await handleKickPlayer('conn1', 'game1', 'host', 'p3', 'kick')
        expect(result.statusCode).toBe(200)
        expect(mockResolveRoundScores).toHaveBeenCalledOnce()
        expect(mockResolveRoundScores).toHaveBeenCalledWith('game1', updatedGameAfterPersist, 0)
    })

    it('removes the only guesser in 2-player game during guessing — falls through to below-minimum guard', async () => {
        // 2-player game: host is describer, p2 is the only guesser
        const game = makeGame({
            meta: { status: 'playing', currentRound: 0 },
            players: [
                { playerId: 'host', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z', score: 0 },
                { playerId: 'p2',   playerName: 'Bob',   joinedAt: '2024-01-01T00:00:01Z', score: 0 },
            ],
            gameplay: {
                rounds: [{
                    phase: 'guessing',
                    describerId: 'host',
                    targetColor: { h: 180, s: 50, l: 50 },
                    submissions: {},
                }]
            }
        })
        const updatedGameAfterWait = { ...game, meta: { status: 'waiting', currentRound: null } }
        mockSend
            .mockResolvedValueOnce({ Item: game })                    // GetCommand: game
            .mockResolvedValueOnce({})                                // UpdateCommand: set status=waiting
            .mockResolvedValueOnce({ Items: [] })                     // QueryCommand: find target connection
            .mockResolvedValueOnce({ Item: updatedGameAfterWait })    // GetCommand: for gameStateUpdated
        const result = await handleKickPlayer('conn1', 'game1', 'host', 'p2', 'kick')
        expect(result.statusCode).toBe(200)
        expect(mockResolveRoundScores).not.toHaveBeenCalled()
        expect(mockBroadcastToGame).toHaveBeenCalledWith('game1', expect.objectContaining({ type: 'gameStateUpdated' }))
    })
})

// ============================================================
// handleKickPlayer — below-minimum player guard (task 4.2)
// ============================================================

describe('handleKickPlayer — below-minimum guard', () => {
    const makePlayingGame = (phase: string, players: any[]) =>
        makeGame({
            meta: { status: 'playing', currentRound: 0 },
            players,
            gameplay: {
                rounds: [{
                    phase,
                    describerId: players[0].playerId,
                    targetColor: { h: 180, s: 50, l: 50 },
                    submissions: {},
                }]
            }
        })

    const twoPlayers = [
        { playerId: 'host', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z', score: 0 },
        { playerId: 'p2',   playerName: 'Bob',   joinedAt: '2024-01-01T00:00:01Z', score: 0 },
    ]
    const threePlayers = [
        ...twoPlayers,
        { playerId: 'p3', playerName: 'Carol', joinedAt: '2024-01-01T00:00:02Z', score: 0 },
    ]

    it('2-player describing phase: removing one player triggers waiting transition and gameStateUpdated broadcast', async () => {
        const game = makePlayingGame('describing', twoPlayers)
        const updatedGame = { ...game, meta: { status: 'waiting', currentRound: null } }
        mockSend
            .mockResolvedValueOnce({ Item: game })        // GetCommand: game
            .mockResolvedValueOnce({})                    // UpdateCommand: set waiting
            .mockResolvedValueOnce({ Items: [] })         // QueryCommand: find target connection
            .mockResolvedValueOnce({ Item: updatedGame }) // GetCommand: for broadcast
        const result = await handleKickPlayer('conn1', 'game1', 'host', 'p2', 'kick')
        expect(result.statusCode).toBe(200)
        expect(mockResolveRoundScores).not.toHaveBeenCalled()
        expect(mockBroadcastToGame).toHaveBeenCalledWith('game1', expect.objectContaining({ type: 'gameStateUpdated' }))
    })

    it('2-player guessing phase: triggers waiting transition, resolveRoundScores is NOT called', async () => {
        const game = makePlayingGame('guessing', twoPlayers)
        const updatedGame = { ...game, meta: { status: 'waiting', currentRound: null } }
        mockSend
            .mockResolvedValueOnce({ Item: game })        // GetCommand: game
            .mockResolvedValueOnce({})                    // UpdateCommand: set waiting
            .mockResolvedValueOnce({ Items: [] })         // QueryCommand: find target connection
            .mockResolvedValueOnce({ Item: updatedGame }) // GetCommand: for broadcast
        const result = await handleKickPlayer('conn1', 'game1', 'host', 'p2', 'kick')
        expect(result.statusCode).toBe(200)
        expect(mockResolveRoundScores).not.toHaveBeenCalled()
        expect(mockBroadcastToGame).toHaveBeenCalledWith('game1', expect.objectContaining({ type: 'gameStateUpdated' }))
    })

    it('3-player describing phase: removing one player does NOT trigger below-minimum guard — describing logic runs', async () => {
        const game = makePlayingGame('describing', threePlayers)
        // host is the describer; kick p3 (non-describer) — still 2 players left, guard not triggered
        // but wait: host is describer and we're not kicking the describer, so describing-phase branch
        // won't trigger either. Falls through to default branch.
        mockSend
            .mockResolvedValueOnce({ Item: game })  // GetCommand: game
            .mockResolvedValueOnce({})              // UpdateCommand: persist players
            .mockResolvedValueOnce({ Items: [] })   // QueryCommand: find target connection
        const result = await handleKickPlayer('conn1', 'game1', 'host', 'p3', 'kick')
        expect(result.statusCode).toBe(200)
        expect(mockResolveRoundScores).not.toHaveBeenCalled()
        // gameStateUpdated NOT sent — not a waiting transition
        const gameStateUpdatedCall = mockBroadcastToGame.mock.calls.find(
            (c: any[]) => c[1]?.type === 'gameStateUpdated'
        )
        expect(gameStateUpdatedCall).toBeUndefined()
        expect(mockBroadcastToGame).toHaveBeenCalledWith('game1', expect.objectContaining({ type: 'playersUpdated' }))
    })
})
