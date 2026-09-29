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

import {
    handleUpdateDraftDescription,
    handleSubmitDescription,
    handleUpdateDraftColor,
    handleSubmitColor,
    handleFinaliseGame,
    handleResetGame,
    handleStartRound,
    handleCloseRoom,
} from './round-handlers'

const makeGame = (overrides: any = {}) => ({
    gameId: 'game1',
    meta: { status: 'playing', currentRound: 0, hostPlayerId: 'describer' },
    config: { maxPlayers: 10, descriptionTimeLimit: 30, guessingTimeLimit: 15, turnsPerPlayer: 2 },
    players: [
        { playerId: 'describer', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z', score: 0 },
        { playerId: 'guesser', playerName: 'Bob', joinedAt: '2024-01-01T00:00:01Z', score: 0 }
    ],
    gameplay: {
        rounds: [{
            targetColor: { h: 180, s: 80, l: 50 },
            describerId: 'describer',
            phase: 'describing',
            submissions: {},
            timers: { descriptionDeadline: null, guessingDeadline: null }
        }]
    },
    ...overrides
})

beforeEach(() => {
    mockSend.mockReset()
    mockBroadcastToGame.mockReset()
    mockSendToConnection.mockReset()
})

// ============================================================
// handleUpdateDraftDescription
// ============================================================

describe('handleUpdateDraftDescription', () => {
    it('returns 400 when description exceeds 100 characters', async () => {
        const result = await handleUpdateDraftDescription('conn1', 'game1', 'describer', 'x'.repeat(101))
        expect(result.statusCode).toBe(400)
    })

    it('returns 404 when game is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handleUpdateDraftDescription('conn1', 'game1', 'describer', 'A nice blue')
        expect(result.statusCode).toBe(404)
    })

    it('returns 400 when not in describing phase', async () => {
        mockSend.mockResolvedValueOnce({
            Item: makeGame({
                gameplay: {
                    rounds: [{ ...makeGame().gameplay.rounds[0], phase: 'guessing' }]
                }
            })
        })
        const result = await handleUpdateDraftDescription('conn1', 'game1', 'describer', 'A nice blue')
        expect(result.statusCode).toBe(400)
    })

    it('returns 400 when caller is not the current describer', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() })
        const result = await handleUpdateDraftDescription('conn1', 'game1', 'guesser', 'A nice blue')
        expect(result.statusCode).toBe(400)
    })

    it('returns 200 for valid draft description update', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() })
        mockSend.mockResolvedValue({})
        const result = await handleUpdateDraftDescription('conn1', 'game1', 'describer', 'A nice blue')
        expect(result.statusCode).toBe(200)
    })
})

// ============================================================
// handleSubmitDescription
// ============================================================

describe('handleSubmitDescription', () => {
    it('returns 400 for empty description', async () => {
        const result = await handleSubmitDescription('conn1', 'game1', 'describer', '')
        expect(result.statusCode).toBe(400)
    })

    it('returns 400 for description longer than 100 characters', async () => {
        const result = await handleSubmitDescription('conn1', 'game1', 'describer', 'x'.repeat(101))
        expect(result.statusCode).toBe(400)
    })

    it('returns 404 when game is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handleSubmitDescription('conn1', 'game1', 'describer', 'Ocean blue')
        expect(result.statusCode).toBe(404)
    })

    it('returns 200 for valid description transitioning to guessing phase', async () => {
        const game = makeGame()
        mockSend
            .mockResolvedValueOnce({ Item: game }) // GetCommand
            .mockResolvedValueOnce({})             // UpdateCommand (conditional)
            .mockResolvedValueOnce({ Item: game }) // GetCommand for broadcast
        const result = await handleSubmitDescription('conn1', 'game1', 'describer', 'Ocean blue')
        expect(result.statusCode).toBe(200)
        expect(mockBroadcastToGame).toHaveBeenCalled()
    })
})

// ============================================================
// handleUpdateDraftColor
// ============================================================

describe('handleUpdateDraftColor', () => {
    it('returns 400 for invalid color (hue out of range)', async () => {
        const result = await handleUpdateDraftColor('conn1', 'game1', 'guesser', { h: 400, s: 50, l: 50 })
        expect(result.statusCode).toBe(400)
    })

    it('returns 400 for invalid color (saturation out of range)', async () => {
        const result = await handleUpdateDraftColor('conn1', 'game1', 'guesser', { h: 180, s: 150, l: 50 })
        expect(result.statusCode).toBe(400)
    })

    it('returns 404 when game is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handleUpdateDraftColor('conn1', 'game1', 'guesser', { h: 180, s: 50, l: 50 })
        expect(result.statusCode).toBe(404)
    })

    it('returns 404 when player is not in the game', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() })
        const result = await handleUpdateDraftColor('conn1', 'game1', 'unknownPlayer', { h: 180, s: 50, l: 50 })
        expect(result.statusCode).toBe(404)
    })

    it('returns 200 for valid color update', async () => {
        const updatedGame = makeGame()
        mockSend
            .mockResolvedValueOnce({ Item: makeGame() })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Item: updatedGame })
        const result = await handleUpdateDraftColor('conn1', 'game1', 'guesser', { h: 180, s: 50, l: 50 })
        expect(result.statusCode).toBe(200)
    })
})

// ============================================================
// handleSubmitColor
// ============================================================

describe('handleSubmitColor', () => {
    it('returns 400 for invalid color', async () => {
        const result = await handleSubmitColor('conn1', 'game1', 'guesser', { h: -10, s: 50, l: 50 })
        expect(result.statusCode).toBe(400)
    })

    it('returns 404 when game is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handleSubmitColor('conn1', 'game1', 'guesser', { h: 180, s: 50, l: 50 })
        expect(result.statusCode).toBe(404)
    })

    it('returns 400 when game is not in guessing phase', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() }) // phase is 'describing'
        const result = await handleSubmitColor('conn1', 'game1', 'guesser', { h: 180, s: 50, l: 50 })
        expect(result.statusCode).toBe(400)
    })

    it('returns 200 and transitions to reveal when all guesses are in', async () => {
        const game = makeGame({
            gameplay: {
                rounds: [{
                    targetColor: { h: 180, s: 80, l: 50 },
                    describerId: 'describer',
                    phase: 'guessing',
                    submissions: {},
                    timers: {},
                }],
            },
        })
        const gameAfterSubmission = {
            ...game,
            gameplay: {
                rounds: [{
                    ...game.gameplay.rounds[0],
                    submissions: { guesser: { h: 180, s: 50, l: 50 } },
                }],
            },
        }
        mockSend
            .mockResolvedValueOnce({ Item: game })               // GetCommand: initial
            .mockResolvedValueOnce({})                           // UpdateCommand: save submission
            .mockResolvedValueOnce({ Item: gameAfterSubmission }) // GetCommand: get updated
            .mockResolvedValueOnce({})                           // UpdateCommand: save scores
            .mockResolvedValueOnce({ Item: gameAfterSubmission }) // GetCommand: final broadcast
        const result = await handleSubmitColor('conn1', 'game1', 'guesser', { h: 180, s: 50, l: 50 })
        expect(result.statusCode).toBe(200)
        expect(mockBroadcastToGame).toHaveBeenCalledWith('game1', expect.objectContaining({ type: 'playersUpdated' }))
    })

    it('returns 409 for duplicate submission', async () => {
        const game = makeGame({
            gameplay: {
                rounds: [{
                    targetColor: { h: 180, s: 80, l: 50 },
                    describerId: 'describer',
                    phase: 'guessing',
                    submissions: { guesser: { h: 100, s: 50, l: 50 } }, // already submitted
                    timers: {}
                }]
            }
        })
        mockSend.mockResolvedValueOnce({ Item: game })
        const result = await handleSubmitColor('conn1', 'game1', 'guesser', { h: 180, s: 50, l: 50 })
        expect(result.statusCode).toBe(409)
    })

    it('retains targetColor in gameplayUpdated when all guesses in (reveal transition)', async () => {
        const target = { h: 180, s: 80, l: 50 }
        const game = makeGame({
            gameplay: {
                rounds: [{
                    targetColor: target,
                    describerId: 'describer',
                    phase: 'guessing',
                    submissions: {},
                    timers: {},
                }],
            },
        })
        // gameAfterSubmission: all guesses are in, handler will transition round to reveal phase
        const gameAfterSubmission = {
            ...game,
            gameplay: {
                rounds: [{
                    targetColor: target,
                    describerId: 'describer',
                    phase: 'guessing',
                    submissions: { guesser: { h: 180, s: 50, l: 50 } },
                    timers: {},
                }],
            },
        }
        // finalGame: handler writes reveal phase with scores; this is what gets broadcast
        const finalGame = {
            ...game,
            gameplay: {
                rounds: [{
                    targetColor: target,
                    describerId: 'describer',
                    phase: 'reveal',
                    submissions: { guesser: { h: 180, s: 50, l: 50 } },
                    scores: { guesser: 95, describer: 95 },
                    timers: {},
                }],
            },
        }
        mockSend
            .mockResolvedValueOnce({ Item: game })               // GetCommand: initial
            .mockResolvedValueOnce({})                           // UpdateCommand: save submission
            .mockResolvedValueOnce({ Item: gameAfterSubmission }) // GetCommand: get updated
            .mockResolvedValueOnce({})                           // UpdateCommand: save scores/reveal
            .mockResolvedValueOnce({ Item: finalGame })          // GetCommand: final broadcast
        await handleSubmitColor('conn1', 'game1', 'guesser', { h: 180, s: 50, l: 50 })
        const gameplayCall = mockBroadcastToGame.mock.calls.find(
            (c: any[]) => c[1]?.type === 'gameplayUpdated'
        )
        expect(gameplayCall).toBeDefined()
        // reveal phase — targetColor should be retained by sanitiser
        expect(gameplayCall[1].gameplay.rounds[0].targetColor).toEqual(target)
    })
})

// ============================================================
// handleStartRound
// ============================================================

describe('handleStartRound', () => {
    it('returns 404 when game is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handleStartRound('conn1', 'game1', 'describer')
        expect(result.statusCode).toBe(404)
    })

    it('returns 403 when non-host tries to start from waiting status', async () => {
        mockSend.mockResolvedValueOnce({
            Item: makeGame({ meta: { status: 'waiting', currentRound: null, hostPlayerId: 'describer' }, gameplay: { rounds: [] } })
        })
        const result = await handleStartRound('conn1', 'game1', 'guesser')
        expect(result.statusCode).toBe(403)
    })

    it('returns 400 when fewer than 2 players', async () => {
        mockSend.mockResolvedValueOnce({
            Item: makeGame({
                meta: { status: 'waiting', currentRound: null, hostPlayerId: 'describer' },
                gameplay: { rounds: [] },
                players: [{ playerId: 'describer', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z', score: 0 }],
            })
        })
        const result = await handleStartRound('conn1', 'game1', 'describer')
        expect(result.statusCode).toBe(400)
    })

    it('returns 409 when state prevents starting a round', async () => {
        // Game is playing but current round is in describing phase (not reveal)
        mockSend.mockResolvedValueOnce({ Item: makeGame() }) // phase is 'describing'
        const result = await handleStartRound('conn1', 'game1', 'describer')
        expect(result.statusCode).toBe(409)
    })

    it('returns 200 when host starts game from waiting status', async () => {
        const game = makeGame({ meta: { status: 'waiting', currentRound: null, hostPlayerId: 'describer' }, gameplay: { rounds: [] } })
        mockSend
            .mockResolvedValueOnce({ Item: game }) // GetCommand
            .mockResolvedValueOnce({})             // UpdateCommand
            .mockResolvedValueOnce({ Item: game }) // GetCommand for broadcast
        const result = await handleStartRound('conn1', 'game1', 'describer')
        expect(result.statusCode).toBe(200)
        expect(mockBroadcastToGame).toHaveBeenCalled()
    })

    it('returns 200 when starting next round from reveal phase', async () => {
        const game = makeGame({
            meta: { status: 'playing', currentRound: 0, hostPlayerId: 'describer' },
            gameplay: {
                rounds: [{ describerId: 'describer', phase: 'reveal', scores: {} }],
            },
        })
        mockSend
            .mockResolvedValueOnce({ Item: game })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Item: game })
        const result = await handleStartRound('conn1', 'game1', 'describer')
        expect(result.statusCode).toBe(200)
    })

    it('strips targetColor from gameplayUpdated broadcast on startRound', async () => {
        const game = makeGame({ meta: { status: 'waiting', currentRound: null, hostPlayerId: 'describer' }, gameplay: { rounds: [] } })
        const gameAfterStart = makeGame({
            meta: { status: 'playing', currentRound: 0, hostPlayerId: 'describer' },
            gameplay: {
                rounds: [{
                    targetColor: { h: 120, s: 60, l: 45 },
                    describerId: 'describer',
                    phase: 'describing',
                    submissions: {}
                }]
            }
        })
        mockSend
            .mockResolvedValueOnce({ Item: game })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Item: gameAfterStart })
        await handleStartRound('conn1', 'game1', 'describer')
        const gameplayCall = mockBroadcastToGame.mock.calls.find(
            (c: any[]) => c[1]?.type === 'gameplayUpdated'
        )
        expect(gameplayCall).toBeDefined()
        expect(gameplayCall[1].gameplay.rounds[0]).not.toHaveProperty('targetColor')
    })
})

// ============================================================
// handleFinaliseGame
// ============================================================

describe('handleFinaliseGame', () => {
    it('returns 404 when game is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handleFinaliseGame('conn1', 'game1', 'host')
        expect(result.statusCode).toBe(404)
    })

    it('returns 400 when not in reveal phase', async () => {
        // host is authoritative so guard passes; phase check fires 400
        mockSend.mockResolvedValueOnce({ Item: makeGame({ meta: { status: 'playing', currentRound: 0, hostPlayerId: 'describer' } }) })
        const result = await handleFinaliseGame('conn1', 'game1', 'describer')
        expect(result.statusCode).toBe(400)
    })

    it('returns 400 when game should not end yet', async () => {
        // Only 1 round each but turnsPerPlayer is 2
        const game = makeGame({
            meta: { status: 'playing', currentRound: 0, hostPlayerId: 'describer' },
            gameplay: {
                rounds: [{
                    describerId: 'describer',
                    phase: 'reveal',
                    scores: {}
                }]
            }
        })
        mockSend.mockResolvedValueOnce({ Item: game })
        const result = await handleFinaliseGame('conn1', 'game1', 'describer')
        expect(result.statusCode).toBe(400)
    })

    it('returns 403 when non-host calls finaliseGame on a valid reveal-phase game', async () => {
        // host is 'describer'; caller is 'guesser' (non-host)
        // game is in reveal phase with shouldEndGame true (2 rounds, turnsPerPlayer=2, each player described once)
        const game = makeGame({
            meta: { status: 'playing', currentRound: 1, hostPlayerId: 'describer' },
            config: { maxPlayers: 10, descriptionTimeLimit: 30, guessingTimeLimit: 15, turnsPerPlayer: 1 },
            gameplay: {
                rounds: [
                    { describerId: 'describer', phase: 'reveal', scores: { describer: 80, guesser: 70 } },
                    { describerId: 'guesser', phase: 'reveal', scores: { describer: 60, guesser: 90 } },
                ]
            }
        })
        mockSend.mockResolvedValueOnce({ Item: game })
        const result = await handleFinaliseGame('conn1', 'game1', 'guesser')
        expect(result.statusCode).toBe(403)
        // No mutating DynamoDB command — only the initial GetCommand was called
        expect(mockSend).toHaveBeenCalledTimes(1)
        expect(mockBroadcastToGame).not.toHaveBeenCalled()
        expect(mockSendToConnection).toHaveBeenCalledWith('conn1', expect.objectContaining({
            type: 'error',
            error: 'Only the host can end the game'
        }))
    })

    it('returns 403 when non-host calls finaliseGame even if phase is NOT reveal (auth before phase check)', async () => {
        // Guard must fire 403 before any 400 phase check
        const game = makeGame({
            meta: { status: 'playing', currentRound: 0, hostPlayerId: 'describer' },
            gameplay: {
                rounds: [{ describerId: 'describer', phase: 'describing', submissions: {}, timers: {} }]
            }
        })
        mockSend.mockResolvedValueOnce({ Item: game })
        const result = await handleFinaliseGame('conn1', 'game1', 'guesser')
        expect(result.statusCode).toBe(403)
        expect(mockSend).toHaveBeenCalledTimes(1)
        expect(mockBroadcastToGame).not.toHaveBeenCalled()
    })

    it('returns 403 for non-host on legacy game (no hostPlayerId) — read-repair still rejects non-host', async () => {
        // No meta.hostPlayerId; 'describer' joined earliest → derived host
        // Caller is 'guesser' → should be rejected
        const game = makeGame({
            meta: { status: 'playing', currentRound: 0 },
            // no hostPlayerId — legacy record
        })
        // GetCommand(game) + UpdateCommand(read-repair persist)
        mockSend.mockResolvedValueOnce({ Item: game })
        mockSend.mockResolvedValueOnce({}) // UpdateCommand for read-repair
        const result = await handleFinaliseGame('conn1', 'game1', 'guesser')
        expect(result.statusCode).toBe(403)
        // Exactly 2 DynamoDB calls: GetCommand (load) + UpdateCommand (read-repair persist).
        // No further writes or reads — the 403 path must not issue any game-state mutation.
        expect(mockSend).toHaveBeenCalledTimes(2)
        expect(mockBroadcastToGame).not.toHaveBeenCalled()
    })

    it('host succeeds: finaliseGame in reveal phase transitions to endgame and broadcasts', async () => {
        const game = makeGame({
            meta: { status: 'playing', currentRound: 1, hostPlayerId: 'describer' },
            config: { maxPlayers: 10, descriptionTimeLimit: 30, guessingTimeLimit: 15, turnsPerPlayer: 1 },
            gameplay: {
                rounds: [
                    { describerId: 'describer', phase: 'reveal', scores: { describer: 80, guesser: 70 } },
                    { describerId: 'guesser', phase: 'reveal', scores: { describer: 60, guesser: 90 } },
                ]
            }
        })
        // GetCommand(game), UpdateCommand(set phase), GetCommand(updated game)
        mockSend.mockResolvedValueOnce({ Item: game })
        mockSend.mockResolvedValueOnce({})   // UpdateCommand
        mockSend.mockResolvedValueOnce({ Item: { ...game, gameplay: { rounds: [
            ...game.gameplay.rounds.slice(0, 1),
            { ...game.gameplay.rounds[1], phase: 'endgame' }
        ]}}})
        const result = await handleFinaliseGame('conn1', 'game1', 'describer')
        expect(result.statusCode).toBe(200)
        expect(mockBroadcastToGame).toHaveBeenCalledWith('game1', expect.objectContaining({ type: 'gameplayUpdated' }))
    })
})

// ============================================================
// handleCloseRoom
// ============================================================

describe('handleCloseRoom', () => {
    it('returns 404 when game is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handleCloseRoom('conn1', 'game1', 'describer')
        expect(result.statusCode).toBe(404)
    })

    it('returns 403 when non-host tries to close room', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() })
        const result = await handleCloseRoom('conn1', 'game1', 'guesser')
        expect(result.statusCode).toBe(403)
    })

    it('returns 200 when host closes room', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() })
        mockSend.mockResolvedValue({})
        const result = await handleCloseRoom('conn1', 'game1', 'describer')
        expect(result.statusCode).toBe(200)
        expect(mockBroadcastToGame).toHaveBeenCalledWith('game1', expect.objectContaining({ type: 'kicked' }))
    })
})

// ============================================================
// handleResetGame
// ============================================================

describe('handleResetGame', () => {
    it('returns 404 when game is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handleResetGame('conn1', 'game1', 'host')
        expect(result.statusCode).toBe(404)
    })

    it('returns 403 when non-host tries to reset', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() })
        const result = await handleResetGame('conn1', 'game1', 'p2')
        expect(result.statusCode).toBe(403)
    })

    it('returns 200 when host resets game', async () => {
        const game = makeGame()
        const hostId = game.players.reduce((earliest: any, p: any) =>
            new Date(p.joinedAt) < new Date(earliest.joinedAt) ? p : earliest
        ).playerId
        mockSend.mockResolvedValue({ Item: game })
        const result = await handleResetGame('conn1', 'game1', hostId)
        expect(result.statusCode).toBe(200)
    })
})

// ============================================================
// Task 6.1: Non-host rejection + no DB mutation
// ============================================================

describe('handleStartRound — non-host rejection (no DB mutation)', () => {
    it('returns 403 and does not write to DB when non-host sends startRound from waiting status', async () => {
        const game = makeGame({ meta: { status: 'waiting', currentRound: null, hostPlayerId: 'describer' }, gameplay: { rounds: [] } })
        mockSend.mockResolvedValueOnce({ Item: game }) // GetCommand
        const result = await handleStartRound('conn1', 'game1', 'guesser')
        expect(result.statusCode).toBe(403)
        // Only the initial GetCommand should have been called (no mutating UpdateCommand)
        const mutateCalls = mockSend.mock.calls.filter(([cmd]) => {
            const input = cmd?.input ?? cmd
            return input.UpdateExpression !== undefined
        })
        expect(mutateCalls.length).toBe(0)
    })

    it('returns 403 and does not write to DB when non-host sends startRound from playing/reveal status', async () => {
        const game = makeGame({
            meta: { status: 'playing', currentRound: 0, hostPlayerId: 'describer' },
            gameplay: {
                rounds: [{ describerId: 'describer', phase: 'reveal', scores: {} }],
            },
        })
        mockSend.mockResolvedValueOnce({ Item: game }) // GetCommand
        const result = await handleStartRound('conn1', 'game1', 'guesser')
        expect(result.statusCode).toBe(403)
        // read-repair UpdateCommand is allowed, but no round-starting mutation
        const roundMutateCalls = mockSend.mock.calls.filter(([cmd]) => {
            const input = cmd?.input ?? cmd
            return (
                input.UpdateExpression !== undefined &&
                !input.UpdateExpression.includes('hostPlayerId')
            )
        })
        expect(roundMutateCalls.length).toBe(0)
    })
})

describe('handleResetGame — non-host rejection (no DB mutation)', () => {
    it('returns 403 and does not write to DB when non-host sends resetGame', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() }) // GetCommand
        const result = await handleResetGame('conn1', 'game1', 'guesser')
        expect(result.statusCode).toBe(403)
        const mutateCalls = mockSend.mock.calls.filter(([cmd]) => {
            const input = cmd?.input ?? cmd
            return input.UpdateExpression !== undefined && !input.UpdateExpression.includes('hostPlayerId')
        })
        expect(mutateCalls.length).toBe(0)
    })
})

describe('handleCloseRoom — non-host rejection (no DB mutation)', () => {
    it('returns 403 and does not write to DB when non-host sends closeRoom', async () => {
        mockSend.mockResolvedValueOnce({ Item: makeGame() }) // GetCommand
        const result = await handleCloseRoom('conn1', 'game1', 'guesser')
        expect(result.statusCode).toBe(403)
        const mutateCalls = mockSend.mock.calls.filter(([cmd]) => {
            const input = cmd?.input ?? cmd
            return input.UpdateExpression !== undefined && !input.UpdateExpression.includes('hostPlayerId')
        })
        expect(mutateCalls.length).toBe(0)
    })
})
