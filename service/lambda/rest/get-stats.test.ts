import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class DynamoDBClient {} }))
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    GetCommand: vi.fn(),
}))

import { handler } from './get-stats'

const makeEvent = (challengeId?: string) => ({
    pathParameters: challengeId ? { challengeId } : null,
}) as any

beforeEach(() => { mockSend.mockReset() })

describe('get-stats handler', () => {
    it('returns 400 when challengeId is missing', async () => {
        const result = await handler(makeEvent())
        expect(result.statusCode).toBe(400)
    })

    it('returns 404 when challenge is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handler(makeEvent('2026-03-15'))
        expect(result.statusCode).toBe(404)
    })

    it('returns 200 with null stats when no submissions', async () => {
        mockSend.mockResolvedValueOnce({ Item: { challengeId: '2026-03-15', totalSubmissions: 0 } })
        const result = await handler(makeEvent('2026-03-15'))
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
        const result = await handler(makeEvent('2026-03-15'))
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
        const result = await handler(makeEvent('2026-03-15'))
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
        const result = await handler(makeEvent('2026-03-15'))
        expect(result.statusCode).toBe(500)
    })
})
