import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend, mockHandleKickPlayer } = vi.hoisted(() => ({
    mockSend: vi.fn(),
    mockHandleKickPlayer: vi.fn(),
}))

vi.mock('./game-handlers', () => ({
    handleKickPlayer: mockHandleKickPlayer,
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: class DynamoDBClient {
        constructor(_config?: any) {}
    },
}))

vi.mock('@aws-sdk/lib-dynamodb', () => {
    class GetCommand { constructor(public input: any) {} }
    class DeleteCommand { constructor(public input: any) {} }
    const DynamoDBDocumentClient = {
        from: (_client: any, _config?: any) => ({ send: mockSend }),
    }
    return { DynamoDBDocumentClient, GetCommand, DeleteCommand }
})

import { handler } from './disconnect'

const makeEvent = (connectionId: string) => ({
    requestContext: { connectionId },
} as any)

beforeEach(() => {
    mockSend.mockClear()
    mockHandleKickPlayer.mockClear()
    mockHandleKickPlayer.mockResolvedValue({ statusCode: 200 })
    process.env.CONNECTIONS_TABLE = 'rgb-connections'
    process.env.GAMES_TABLE = 'rgb-games'
})

// ============================================================
// Waiting lobby — no kick
// ============================================================

describe('disconnect handler — waiting lobby', () => {
    it('does NOT call handleKickPlayer when game status is waiting', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: { connectionId: 'conn1', gameId: 'game1', playerId: 'player1' } }) // GetCommand (connection)
            .mockResolvedValueOnce({})                                                                          // DeleteCommand
            .mockResolvedValueOnce({ Item: { meta: { status: 'waiting' } } })                                  // GetCommand (game)

        const result = await handler(makeEvent('conn1'))

        expect(result.statusCode).toBe(200)
        expect(mockHandleKickPlayer).not.toHaveBeenCalled()
    })

    it('still deletes the connection record even for waiting games', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: { connectionId: 'conn1', gameId: 'game1', playerId: 'player1' } })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Item: { meta: { status: 'waiting' } } })

        await handler(makeEvent('conn1'))

        const deleteArg = mockSend.mock.calls[1][0]
        expect(deleteArg.input.Key).toEqual({ connectionId: 'conn1' })
        expect(deleteArg.input.TableName).toBe('rgb-connections')
    })
})

// ============================================================
// Playing game — kick immediately
// ============================================================

describe('disconnect handler — playing game', () => {
    it('calls handleKickPlayer when game status is playing', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: { connectionId: 'conn1', gameId: 'game1', playerId: 'player1' } })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Item: { meta: { status: 'playing' } } })

        const result = await handler(makeEvent('conn1'))

        expect(result.statusCode).toBe(200)
        expect(mockHandleKickPlayer).toHaveBeenCalledWith('conn1', 'game1', 'player1', 'player1', 'disconnect')
    })

    it('calls handleKickPlayer when game is not found (defensive — treat as playing)', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: { connectionId: 'conn1', gameId: 'game1', playerId: 'player1' } })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Item: undefined }) // game not found

        const result = await handler(makeEvent('conn1'))

        expect(result.statusCode).toBe(200)
        expect(mockHandleKickPlayer).toHaveBeenCalledWith('conn1', 'game1', 'player1', 'player1', 'disconnect')
    })
})

// ============================================================
// No game association — just delete connection
// ============================================================

describe('disconnect handler — no game association', () => {
    it('does not call handleKickPlayer when connection has no gameId', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: { connectionId: 'conn1' } }) // no gameId
            .mockResolvedValueOnce({}) // DeleteCommand

        const result = await handler(makeEvent('conn1'))
        expect(result.statusCode).toBe(200)
        expect(mockHandleKickPlayer).not.toHaveBeenCalled()
    })

    it('does not call handleKickPlayer when connection record is absent', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: undefined }) // no record
            .mockResolvedValueOnce({}) // DeleteCommand

        const result = await handler(makeEvent('conn1'))
        expect(result.statusCode).toBe(200)
        expect(mockHandleKickPlayer).not.toHaveBeenCalled()
    })
})

// ============================================================
// Error handling
// ============================================================

describe('disconnect handler — error handling', () => {
    it('returns 500 when DynamoDB throws', async () => {
        mockSend.mockRejectedValueOnce(new Error('DynamoDB failure'))
        const result = await handler(makeEvent('conn1'))
        expect(result.statusCode).toBe(500)
    })
})
