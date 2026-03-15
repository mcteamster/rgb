import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class DynamoDBClient {} }))
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    QueryCommand: vi.fn(),
    BatchGetCommand: vi.fn(),
}))

import { handler } from './get-user-history'

const makeEvent = (userId?: string, limit?: string) => ({
    pathParameters: userId ? { userId } : null,
    queryStringParameters: limit ? { limit } : null,
}) as any

beforeEach(() => {
    mockSend.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))
})

afterEach(() => {
    vi.useRealTimers()
})

describe('get-user-history handler', () => {
    it('returns 400 when userId is missing', async () => {
        const result = await handler(makeEvent())
        expect(result.statusCode).toBe(400)
    })

    it('returns 200 with empty stats when user has no submissions', async () => {
        mockSend.mockResolvedValueOnce({ Items: [] })
        const result = await handler(makeEvent('user123'))
        expect(result.statusCode).toBe(200)
        const body = JSON.parse(result.body)
        expect(body.submissions).toHaveLength(0)
        expect(body.stats.totalPlayed).toBe(0)
        expect(body.stats.currentStreak).toBe(0)
    })

    it('returns 200 with submissions and calculated stats', async () => {
        const submissions = [
            { challengeId: '2026-03-15', score: 90, submittedAt: '2026-03-15T10:00:00Z', submittedColor: { h: 10, s: 50, l: 50 }, averageAtSubmission: { h: 10, s: 50, l: 50 } },
            { challengeId: '2026-03-14', score: 70, submittedAt: '2026-03-14T10:00:00Z', submittedColor: { h: 20, s: 60, l: 40 }, averageAtSubmission: { h: 20, s: 60, l: 40 } },
        ]
        mockSend.mockResolvedValueOnce({ Items: submissions })
        mockSend.mockResolvedValueOnce({
            Responses: {
                '': [
                    { challengeId: '2026-03-15', prompt: 'Cherry Blossom', totalSubmissions: 10 },
                    { challengeId: '2026-03-14', prompt: 'Stormy Sky', totalSubmissions: 5 },
                ]
            }
        })
        const result = await handler(makeEvent('user123'))
        expect(result.statusCode).toBe(200)
        const body = JSON.parse(result.body)
        expect(body.stats.totalPlayed).toBe(2)
        expect(body.stats.bestScore).toBe(90)
        expect(body.stats.averageScore).toBe(80)
    })

    it('calculates a streak of 2 for consecutive days including today', async () => {
        const submissions = [
            { challengeId: '2026-03-15', score: 80, submittedAt: '2026-03-15T10:00:00Z', submittedColor: {}, averageAtSubmission: {} },
            { challengeId: '2026-03-14', score: 75, submittedAt: '2026-03-14T09:00:00Z', submittedColor: {}, averageAtSubmission: {} },
        ]
        mockSend.mockResolvedValueOnce({ Items: submissions })
        mockSend.mockResolvedValueOnce({ Responses: { '': [] } })
        const result = await handler(makeEvent('user123'))
        const body = JSON.parse(result.body)
        expect(body.stats.currentStreak).toBe(2)
    })

    it('streak is 0 when today has no submission', async () => {
        const submissions = [
            // Most recent is yesterday, not today
            { challengeId: '2026-03-14', score: 75, submittedAt: '2026-03-14T09:00:00Z', submittedColor: {}, averageAtSubmission: {} },
        ]
        mockSend.mockResolvedValueOnce({ Items: submissions })
        mockSend.mockResolvedValueOnce({ Responses: { '': [] } })
        const result = await handler(makeEvent('user123'))
        const body = JSON.parse(result.body)
        expect(body.stats.currentStreak).toBe(0)
    })

    it('streak breaks on a gap in dates', async () => {
        const submissions = [
            { challengeId: '2026-03-15', score: 80, submittedAt: '2026-03-15T10:00:00Z', submittedColor: {}, averageAtSubmission: {} },
            // Gap: 2026-03-14 missing
            { challengeId: '2026-03-13', score: 70, submittedAt: '2026-03-13T09:00:00Z', submittedColor: {}, averageAtSubmission: {} },
        ]
        mockSend.mockResolvedValueOnce({ Items: submissions })
        mockSend.mockResolvedValueOnce({ Responses: { '': [] } })
        const result = await handler(makeEvent('user123'))
        const body = JSON.parse(result.body)
        expect(body.stats.currentStreak).toBe(1)
    })

    it('returns 500 on unexpected error', async () => {
        mockSend.mockRejectedValueOnce(new Error('DynamoDB error'))
        const result = await handler(makeEvent('user123'))
        expect(result.statusCode).toBe(500)
    })
})
