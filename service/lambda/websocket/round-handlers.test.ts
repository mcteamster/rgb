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
} from './round-handlers'

const makeGame = (overrides: any = {}) => ({
    gameId: 'game1',
    meta: { status: 'playing', currentRound: 0 },
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
        mockSend.mockResolvedValueOnce({ Item: makeGame() }) // phase is 'describing'
        const result = await handleFinaliseGame('conn1', 'game1', 'host')
        expect(result.statusCode).toBe(400)
    })

    it('returns 400 when game should not end yet', async () => {
        // Only 1 round each but turnsPerPlayer is 2
        const game = makeGame({
            gameplay: {
                rounds: [{
                    describerId: 'describer',
                    phase: 'reveal',
                    scores: {}
                }]
            }
        })
        mockSend.mockResolvedValueOnce({ Item: game })
        const result = await handleFinaliseGame('conn1', 'game1', 'host')
        expect(result.statusCode).toBe(400)
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
        // Derive the host the same way the handler does (earliest joinedAt)
        const hostId = game.players.reduce((earliest: any, p: any) =>
            new Date(p.joinedAt) < new Date(earliest.joinedAt) ? p : earliest
        ).playerId
        mockSend.mockResolvedValue({ Item: game })
        const result = await handleResetGame('conn1', 'game1', hostId)
        expect(result.statusCode).toBe(200)
    })
})
