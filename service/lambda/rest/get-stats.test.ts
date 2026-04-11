import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class DynamoDBClient {} }))
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    GetCommand: vi.fn(),
}))

import { handler } from './get-stats'

const makeEvent = (challengeId?: string, userId?: string) => ({
    pathParameters: challengeId ? { challengeId } : null,
    queryStringParameters: userId ? { userId } : null,
}) as any

beforeEach(() => { mockSend.mockReset() })

describe('get-stats handler', () => {
    it('returns 400 when challengeId is missing', async () => {
        const result = await handler(makeEvent(undefined, 'user-123'))
        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toMatch(/challengeId/)
    })

    it('returns 400 when userId is missing', async () => {
        const result = await handler(makeEvent('2026-03-15'))
        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toMatch(/userId/)
    })

    it('returns 404 when challenge is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handler(makeEvent('2026-03-15', 'user-123'))
        expect(result.statusCode).toBe(404)
    })

    it('returns 403 when user has no submission for the challenge', async () => {
        mockSend.mockResolvedValueOnce({ Item: { challengeId: '2026-03-15', totalSubmissions: 5 } })
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handler(makeEvent('2026-03-15', 'user-123'))
        expect(result.statusCode).toBe(403)
        expect(JSON.parse(result.body).error).toMatch(/Submit a guess/)
    })

    it('returns 200 with null stats when no submissions', async () => {
        mockSend.mockResolvedValueOnce({ Item: { challengeId: '2026-03-15', totalSubmissions: 0 } })
        mockSend.mockResolvedValueOnce({ Item: { userId: 'user-123', challengeId: '2026-03-15' } })
        const result = await handler(makeEvent('2026-03-15', 'user-123'))
        expect(result.statusCode).toBe(200)
        const body = JSON.parse(result.body)
        expect(body.totalSubmissions).toBe(0)
        expect(body.averageColor).toBeNull()
        expect(body.hue).toBeNull()
    })

    it('returns null component stats for legacy challenges without componentStats', async () => {
        mockSend.mockResolvedValueOnce({
            Item: {
                challengeId: '2026-03-15',
                totalSubmissions: 10,
                averageColor: { h: 180, s: 50, l: 50 },
                // No componentStats
            }
        })
        mockSend.mockResolvedValueOnce({ Item: { userId: 'user-123', challengeId: '2026-03-15' } })
        const result = await handler(makeEvent('2026-03-15', 'user-123'))
        expect(result.statusCode).toBe(200)
        const body = JSON.parse(result.body)
        expect(body.totalSubmissions).toBe(10)
        expect(body.hue).toBeNull()
    })

    it('returns 200 with calculated stdDev when componentStats present', async () => {
        mockSend.mockResolvedValueOnce({
            Item: {
                challengeId: '2026-03-15',
                totalSubmissions: 4,
                averageColor: { h: 180, s: 50, l: 50 },
                componentStats: {
                    h: { mean: 180, m2: 100 },
                    s: { mean: 50, m2: 64 },
                    l: { mean: 50, m2: 36 },
                }
            }
        })
        mockSend.mockResolvedValueOnce({ Item: { userId: 'user-123', challengeId: '2026-03-15' } })
        const result = await handler(makeEvent('2026-03-15', 'user-123'))
        expect(result.statusCode).toBe(200)
        const body = JSON.parse(result.body)
        // stdDev = sqrt(m2 / n) = sqrt(100 / 4) = 5
        expect(body.hue.avg).toBe(180)
        expect(body.hue.stdDev).toBeCloseTo(5)
        expect(body.saturation.stdDev).toBeCloseTo(4)
        expect(body.lightness.stdDev).toBeCloseTo(3)
    })

    it('returns 500 on unexpected error', async () => {
        mockSend.mockRejectedValueOnce(new Error('DynamoDB error'))
        const result = await handler(makeEvent('2026-03-15', 'user-123'))
        expect(result.statusCode).toBe(500)
    })
})
