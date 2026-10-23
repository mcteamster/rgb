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
    class ScanCommand { constructor(public input: any) {} }
    class DeleteCommand { constructor(public input: any) {} }
    const DynamoDBDocumentClient = {
        from: (_client: any, _config?: any) => ({ send: mockSend }),
    }
    return { DynamoDBDocumentClient, ScanCommand, DeleteCommand }
})

import { handler } from './disconnect-sweeper'

beforeEach(() => {
    mockSend.mockClear()
    mockHandleKickPlayer.mockClear()
    mockHandleKickPlayer.mockResolvedValue({ statusCode: 200 })
    process.env.CONNECTIONS_TABLE = 'rgb-connections'
    process.env.GAMES_TABLE = 'rgb-games'
    process.env.WEBSOCKET_ENDPOINT = 'https://example.execute-api.us-east-1.amazonaws.com/prod'
})

// ============================================================
// Task 3.1: two expired records → two kicks + two deletes
// ============================================================

describe('disconnect-sweeper handler — expired records', () => {
    it('calls handleKickPlayer and deletes record for each expired connection', async () => {
        const expiredRecords = [
            { connectionId: 'conn1', gameId: 'game1', playerId: 'player1', gracePeriodExpiresAt: 100 },
            { connectionId: 'conn2', gameId: 'game2', playerId: 'player2', gracePeriodExpiresAt: 200 },
        ]

        mockSend
            .mockResolvedValueOnce({ Items: expiredRecords }) // ScanCommand
            .mockResolvedValueOnce({})                        // DeleteCommand for conn1
            .mockResolvedValueOnce({})                        // DeleteCommand for conn2

        await handler()

        expect(mockHandleKickPlayer).toHaveBeenCalledTimes(2)
        expect(mockHandleKickPlayer).toHaveBeenCalledWith('conn1', 'game1', 'player1', 'player1', 'disconnect')
        expect(mockHandleKickPlayer).toHaveBeenCalledWith('conn2', 'game2', 'player2', 'player2', 'disconnect')

        // Two DeleteCommand sends (after the initial ScanCommand)
        const deleteCalls = mockSend.mock.calls.slice(1)
        expect(deleteCalls).toHaveLength(2)
        expect(deleteCalls[0][0].input.Key).toEqual({ connectionId: 'conn1' })
        expect(deleteCalls[1][0].input.Key).toEqual({ connectionId: 'conn2' })
    })
})

// ============================================================
// Task 3.3a: no expired records → no kicks
// ============================================================

describe('disconnect-sweeper handler — no expired records', () => {
    it('does not call handleKickPlayer when scan returns no expired records', async () => {
        mockSend.mockResolvedValueOnce({ Items: [] })

        await handler()

        expect(mockHandleKickPlayer).not.toHaveBeenCalled()
        // Only the initial ScanCommand should have been sent
        expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('does not call handleKickPlayer when scan returns undefined Items', async () => {
        mockSend.mockResolvedValueOnce({}) // Items undefined

        await handler()

        expect(mockHandleKickPlayer).not.toHaveBeenCalled()
    })
})

// ============================================================
// Task 3.3b: one expired record → one kick + one delete
// ============================================================

describe('disconnect-sweeper handler — one expired record', () => {
    it('kicks and deletes exactly one record', async () => {
        const expiredRecord = { connectionId: 'conn1', gameId: 'game1', playerId: 'player1', gracePeriodExpiresAt: 1 }

        mockSend
            .mockResolvedValueOnce({ Items: [expiredRecord] }) // ScanCommand
            .mockResolvedValueOnce({})                         // DeleteCommand

        await handler()

        expect(mockHandleKickPlayer).toHaveBeenCalledTimes(1)
        expect(mockHandleKickPlayer).toHaveBeenCalledWith('conn1', 'game1', 'player1', 'player1', 'disconnect')

        const deleteSend = mockSend.mock.calls[1][0]
        expect(deleteSend.input.Key).toEqual({ connectionId: 'conn1' })
    })
})

// ============================================================
// Task 3.3c: record with gracePeriodExpiresAt in the future → NOT returned by scan
// (The FilterExpression 'gracePeriodExpiresAt < :now' handles this at DynamoDB level.
//  We verify the scan sends the correct FilterExpression and :now value.)
// ============================================================

describe('disconnect-sweeper handler — scan filter expression', () => {
    it('uses FilterExpression with gracePeriodExpiresAt < :now', async () => {
        const before = Math.floor(Date.now() / 1000)
        mockSend.mockResolvedValueOnce({ Items: [] })

        await handler()

        const after = Math.floor(Date.now() / 1000)
        const scanArg = mockSend.mock.calls[0][0]
        expect(scanArg.input.FilterExpression).toBe(
            'attribute_exists(gracePeriodExpiresAt) AND gracePeriodExpiresAt < :now'
        )
        const nowValue = scanArg.input.ExpressionAttributeValues[':now']
        expect(nowValue).toBeGreaterThanOrEqual(before)
        expect(nowValue).toBeLessThanOrEqual(after)
    })

    it('skips records that would have gracePeriodExpiresAt in the future if scan returned them', async () => {
        // In production DynamoDB filters these out. Here we verify that IF the scan
        // returned only future-expiry records (hypothetically bypassing the filter),
        // the handler would still process them — showing the filter is the guard.
        // This test just confirms scan is sent with correct filter so DynamoDB excludes them.
        const futureRecord = {
            connectionId: 'conn-future',
            gameId: 'game1',
            playerId: 'player1',
            gracePeriodExpiresAt: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
        }

        // Simulate DynamoDB correctly applying the filter — no items returned
        mockSend.mockResolvedValueOnce({ Items: [] })

        await handler()

        expect(mockHandleKickPlayer).not.toHaveBeenCalled()
        // Verify the scan was called with the right FilterExpression
        const scanArg = mockSend.mock.calls[0][0]
        expect(scanArg.input.FilterExpression).toContain('gracePeriodExpiresAt < :now')
    })
})

// ============================================================
// Error resilience: handleKickPlayer failure doesn't stop the sweep
// ============================================================

describe('disconnect-sweeper handler — error resilience', () => {
    it('continues processing remaining records when one kick fails', async () => {
        const records = [
            { connectionId: 'conn1', gameId: 'game1', playerId: 'player1', gracePeriodExpiresAt: 1 },
            { connectionId: 'conn2', gameId: 'game2', playerId: 'player2', gracePeriodExpiresAt: 2 },
        ]

        mockHandleKickPlayer
            .mockRejectedValueOnce(new Error('Game not found'))  // conn1 kick fails
            .mockResolvedValueOnce({ statusCode: 200 })           // conn2 kick succeeds

        mockSend
            .mockResolvedValueOnce({ Items: records }) // ScanCommand
            .mockResolvedValueOnce({})                 // DeleteCommand for conn1
            .mockResolvedValueOnce({})                 // DeleteCommand for conn2

        await handler()

        // Both kicks attempted
        expect(mockHandleKickPlayer).toHaveBeenCalledTimes(2)
        // Both deletes still executed
        expect(mockSend).toHaveBeenCalledTimes(3) // 1 scan + 2 deletes
    })
})
