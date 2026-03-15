import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class DynamoDBClient {} }))
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    GetCommand: class GetCommand {
        [key: string]: any
        constructor(params: any) { Object.assign(this, params) }
    },
    UpdateCommand: class UpdateCommand {
        [key: string]: any
        constructor(params: any) { Object.assign(this, params) }
    },
}))

import { handler } from './create-daily-challenge'

const makeEvent = () => ({} as any)

beforeEach(() => { mockSend.mockReset() })

describe('create-daily-challenge handler', () => {
    it('skips creation when challenge is already active', async () => {
        mockSend.mockResolvedValueOnce({ Item: { status: 'active' } })
        await handler(makeEvent())
        // Only one send call (the GetCommand) — no UpdateCommand
        expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('activates a queued challenge using its stored prompt', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: { status: 'queued', prompt: 'Cherry Blossom' } }) // GetCommand
            .mockResolvedValueOnce({})  // UpdateCommand: activate today
            .mockResolvedValueOnce({})  // UpdateCommand: mark old challenge inactive (may or may not throw)
        await handler(makeEvent())
        // UpdateCommand should have been called with the queued prompt
        const updateCall = mockSend.mock.calls[1][0]
        expect(updateCall.ExpressionAttributeValues[':prompt']).toBe('Cherry Blossom')
    })

    it('uses fallback prompt when no queued challenge exists', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: undefined }) // no existing challenge
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
        await handler(makeEvent())
        const updateCall = mockSend.mock.calls[1][0]
        expect(updateCall.ExpressionAttributeValues[':prompt']).toBe('A color that makes you happy')
    })

    it('activates with status=active and sets validFrom/validUntil', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: { status: 'queued', prompt: 'Deep Ocean' } })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
        await handler(makeEvent())
        const updateCall = mockSend.mock.calls[1][0]
        const values = updateCall.ExpressionAttributeValues
        expect(values[':active']).toBe('active')
        expect(values[':from']).toBeTruthy()
        expect(values[':until']).toBeTruthy()
        expect(new Date(values[':until']).getTime()).toBeGreaterThan(new Date(values[':from']).getTime())
    })

    it('throws on unexpected DynamoDB error', async () => {
        mockSend.mockRejectedValueOnce(new Error('DynamoDB down'))
        await expect(handler(makeEvent())).rejects.toThrow('DynamoDB down')
    })
})
