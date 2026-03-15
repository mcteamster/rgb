import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class DynamoDBClient {} }))
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    GetCommand: vi.fn(),
}))

import { handler } from './get-challenge-by-date'

const makeEvent = (date?: string, userId?: string) => ({
    pathParameters: date ? { date } : null,
    queryStringParameters: userId ? { userId } : null,
}) as any

const recentChallenge = {
    challengeId: '2026-03-10',
    prompt: 'Fresh Grass',
    status: 'active',
    validFrom: '2026-03-10T00:00:00Z',
    validUntil: '2026-03-11T00:00:00Z',
    totalSubmissions: 20,
}

beforeEach(() => {
    mockSend.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))
})

afterEach(() => { vi.useRealTimers() })

describe('get-challenge-by-date handler', () => {
    it('returns 400 when date parameter is missing', async () => {
        const result = await handler(makeEvent())
        expect(result.statusCode).toBe(400)
    })

    it('returns 404 when challenge is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handler(makeEvent('2026-03-10'))
        expect(result.statusCode).toBe(404)
    })

    it('returns 410 for challenge older than 30 days', async () => {
        mockSend.mockResolvedValueOnce({ Item: { challengeId: '2025-01-01' } })
        const result = await handler(makeEvent('2025-01-01'))
        expect(result.statusCode).toBe(410)
    })

    it('returns 200 with challenge data for a recent date', async () => {
        mockSend.mockResolvedValueOnce({ Item: recentChallenge })
        const result = await handler(makeEvent('2026-03-10'))
        expect(result.statusCode).toBe(200)
        const body = JSON.parse(result.body)
        expect(body.challenge.prompt).toBe('Fresh Grass')
        expect(body.userSubmission).toBeNull()
    })

    it('includes userSubmission when userId is provided and submission exists', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: recentChallenge })
            .mockResolvedValueOnce({
                Item: {
                    submittedColor: { h: 120, s: 80, l: 40 },
                    score: 92,
                    submittedAt: '2026-03-10T09:00:00Z',
                    averageAtSubmission: { h: 118, s: 78, l: 42 },
                    distanceFromAverage: 0.05
                }
            })
        const result = await handler(makeEvent('2026-03-10', 'user123'))
        expect(result.statusCode).toBe(200)
        const body = JSON.parse(result.body)
        expect(body.userSubmission.score).toBe(92)
    })

    it('returns 500 on unexpected error', async () => {
        mockSend.mockRejectedValueOnce(new Error('DynamoDB error'))
        const result = await handler(makeEvent('2026-03-10'))
        expect(result.statusCode).toBe(500)
    })
})
