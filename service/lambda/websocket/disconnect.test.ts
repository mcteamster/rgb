import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoist mocks so they're available when module factory runs
const { mockSend, mockHandleKickPlayer } = vi.hoisted(() => ({
    mockSend: vi.fn(),
    mockHandleKickPlayer: vi.fn(),
}))

vi.mock('./game-handlers', () => ({
    handleKickPlayer: mockHandleKickPlayer,
}))

// Mock the AWS SDK modules that disconnect.ts uses at module level.
// DynamoDBClient must be a real class (constructor); DynamoDBDocumentClient.from
// returns the shared mockSend-backed object captured via vi.hoisted.
vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: class DynamoDBClient {
        constructor(_config?: any) {}
    },
}))

vi.mock('@aws-sdk/lib-dynamodb', () => {
    // Command constructors just wrap input so tests can inspect it
    class GetCommand { constructor(public input: any) {} }
    class DeleteCommand { constructor(public input: any) {} }
    class UpdateCommand { constructor(public input: any) {} }
    const DynamoDBDocumentClient = {
        from: (_client: any, _config?: any) => ({ send: mockSend }),
    }
    return { DynamoDBDocumentClient, GetCommand, DeleteCommand, UpdateCommand }
})

// Import handler AFTER mocks are set up
import { handler } from './disconnect'

const makeEvent = (connectionId: string) => ({
    requestContext: { connectionId },
} as any)

beforeEach(() => {
    // Use mockClear so the function identity stays the same; mockReset would
    // erase the implementation and require re-adding .mockResolvedValue each time.
    mockSend.mockClear()
    mockHandleKickPlayer.mockClear()
    mockHandleKickPlayer.mockResolvedValue({ statusCode: 200 })
    // Set env defaults
    process.env.CONNECTIONS_TABLE = 'rgb-connections'
    process.env.GAMES_TABLE = 'rgb-games'
    process.env.DISCONNECT_GRACE_PERIOD_SECONDS = '30'
})

afterEach(() => {
    delete process.env.DISCONNECT_GRACE_PERIOD_SECONDS
})

// ============================================================
// Grace-period ENABLED path (tasks 2.1, 2.3)
// ============================================================

describe('disconnect handler — grace period enabled', () => {
    it('writes gracePeriodExpiresAt and does NOT call handleKickPlayer when grace > 0 and connection has gameId', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: { connectionId: 'conn1', gameId: 'game1', playerId: 'player1' } }) // GetCommand
            .mockResolvedValueOnce({}) // UpdateCommand

        const result = await handler(makeEvent('conn1'))

        expect(result.statusCode).toBe(200)
        expect(mockHandleKickPlayer).not.toHaveBeenCalled()

        // Second send call should be the UpdateCommand with gracePeriodExpiresAt
        const updateArg = mockSend.mock.calls[1][0]
        expect(updateArg.input.UpdateExpression).toContain('gracePeriodExpiresAt')
        expect(updateArg.input.ExpressionAttributeValues[':expiresAt']).toBeGreaterThan(
            Math.floor(Date.now() / 1000) - 5
        )
    })

    it('gracePeriodExpiresAt is approximately now + 30 seconds', async () => {
        const before = Math.floor(Date.now() / 1000)
        mockSend
            .mockResolvedValueOnce({ Item: { connectionId: 'conn1', gameId: 'game1', playerId: 'player1' } })
            .mockResolvedValueOnce({})

        await handler(makeEvent('conn1'))

        const after = Math.floor(Date.now() / 1000)
        const updateArg = mockSend.mock.calls[1][0]
        const expiresAt = updateArg.input.ExpressionAttributeValues[':expiresAt']
        expect(expiresAt).toBeGreaterThanOrEqual(before + 30)
        expect(expiresAt).toBeLessThanOrEqual(after + 30)
    })

    it('falls through to delete+no-kick path when connection has no gameId', async () => {
        // No gameId — grace period branch requires gameId, so falls through to delete path
        mockSend
            .mockResolvedValueOnce({ Item: { connectionId: 'conn1' } }) // GetCommand: no gameId
            .mockResolvedValueOnce({}) // DeleteCommand

        const result = await handler(makeEvent('conn1'))
        expect(result.statusCode).toBe(200)
        expect(mockHandleKickPlayer).not.toHaveBeenCalled()
    })
})

// ============================================================
// Grace-period DISABLED path (tasks 2.2, 2.3)
// ============================================================

describe('disconnect handler — grace period disabled (DISCONNECT_GRACE_PERIOD_SECONDS=0)', () => {
    beforeEach(() => {
        process.env.DISCONNECT_GRACE_PERIOD_SECONDS = '0'
    })

    it('calls handleKickPlayer immediately when grace=0 and connection has gameId', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: { connectionId: 'conn1', gameId: 'game1', playerId: 'player1' } })
            .mockResolvedValueOnce({}) // DeleteCommand

        const result = await handler(makeEvent('conn1'))

        expect(result.statusCode).toBe(200)
        expect(mockHandleKickPlayer).toHaveBeenCalledWith('conn1', 'game1', 'player1', 'player1', 'disconnect')
    })

    it('deletes the connection record before calling handleKickPlayer', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: { connectionId: 'conn1', gameId: 'game1', playerId: 'player1' } })
            .mockResolvedValueOnce({}) // DeleteCommand

        await handler(makeEvent('conn1'))

        // Second send call should be the DeleteCommand
        const deleteArg = mockSend.mock.calls[1][0]
        expect(deleteArg.input.Key).toEqual({ connectionId: 'conn1' })
        expect(deleteArg.input.TableName).toBe('rgb-connections')
    })

    it('does NOT call handleKickPlayer when there is no gameId even with grace=0', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: { connectionId: 'conn1' } }) // GetCommand: no gameId
            .mockResolvedValueOnce({}) // DeleteCommand

        const result = await handler(makeEvent('conn1'))
        expect(result.statusCode).toBe(200)
        expect(mockHandleKickPlayer).not.toHaveBeenCalled()
    })
})

// ============================================================
// Grace period env var absent (defaults to 0 — disabled)
// ============================================================

describe('disconnect handler — DISCONNECT_GRACE_PERIOD_SECONDS unset', () => {
    beforeEach(() => {
        delete process.env.DISCONNECT_GRACE_PERIOD_SECONDS
    })

    it('calls handleKickPlayer immediately when env var is absent', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: { connectionId: 'conn1', gameId: 'game1', playerId: 'player1' } })
            .mockResolvedValueOnce({}) // DeleteCommand

        const result = await handler(makeEvent('conn1'))
        expect(result.statusCode).toBe(200)
        expect(mockHandleKickPlayer).toHaveBeenCalledWith('conn1', 'game1', 'player1', 'player1', 'disconnect')
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
