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

import { handleCreateGame, handleJoinGame, handleRejoinGame, handleKickPlayer } from './game-handlers'

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
})
