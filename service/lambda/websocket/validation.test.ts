import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('./aws-clients', () => ({
    dynamodb: { send: mockSend },
    broadcastToGame: vi.fn(),
    sendToConnection: vi.fn(),
}))

import { validatePlayerAction } from './validation'

beforeEach(() => {
    mockSend.mockReset()
})

describe('validatePlayerAction', () => {
    it('returns 404 when game is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await validatePlayerAction('conn1', 'game1', 'player1')
        expect(result.statusCode).toBe(404)
    })

    it('returns 403 when player is not in the game', async () => {
        mockSend.mockResolvedValueOnce({
            Item: { gameId: 'game1', players: [{ playerId: 'player2' }] }
        })
        const result = await validatePlayerAction('conn1', 'game1', 'player1')
        expect(result.statusCode).toBe(403)
    })

    it('returns 403 when connection does not belong to the player', async () => {
        mockSend
            .mockResolvedValueOnce({
                Item: { gameId: 'game1', players: [{ playerId: 'player1' }] }
            })
            .mockResolvedValueOnce({
                Item: { playerId: 'differentPlayer', gameId: 'game1' }
            })
        const result = await validatePlayerAction('conn1', 'game1', 'player1')
        expect(result.statusCode).toBe(403)
    })

    it('returns 403 when connection record is missing', async () => {
        mockSend
            .mockResolvedValueOnce({
                Item: { gameId: 'game1', players: [{ playerId: 'player1' }] }
            })
            .mockResolvedValueOnce({ Item: undefined })
        const result = await validatePlayerAction('conn1', 'game1', 'player1')
        expect(result.statusCode).toBe(403)
    })

    it('returns 200 when player and connection are valid', async () => {
        mockSend
            .mockResolvedValueOnce({
                Item: { gameId: 'game1', players: [{ playerId: 'player1' }] }
            })
            .mockResolvedValueOnce({
                Item: { playerId: 'player1', gameId: 'game1' }
            })
        const result = await validatePlayerAction('conn1', 'game1', 'player1')
        expect(result.statusCode).toBe(200)
    })
})
