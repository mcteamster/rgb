import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class DynamoDBClient {} }))
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    GetCommand: vi.fn(),
    QueryCommand: vi.fn(),
}))

import { handler } from './get-current-challenge'

const makeEvent = (params: { userId?: string; localDate?: string } = {}) => ({
    queryStringParameters: (params.userId || params.localDate) ? params : null,
}) as any

beforeEach(() => { mockSend.mockReset() })

describe('get-current-challenge handler', () => {
    it('returns 404 when no challenge exists for today', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handler(makeEvent())
        expect(result.statusCode).toBe(404)
        expect(JSON.parse(result.body).error).toBeTruthy()
    })

    it('returns 200 with challenge data when found', async () => {
        mockSend.mockResolvedValueOnce({
            Item: {
                challengeId: '2026-03-15',
                prompt: 'Cherry Blossom',
                validFrom: '2026-03-15T00:00:00Z',
                validUntil: '2026-03-16T00:00:00Z',
                totalSubmissions: 42,
            }
        })
        const result = await handler(makeEvent())
        expect(result.statusCode).toBe(200)
        const body = JSON.parse(result.body)
        expect(body.prompt).toBe('Cherry Blossom')
        expect(body.totalSubmissions).toBe(42)
        expect(body.userSubmission).toBeNull()
    })

    it('uses localDate param as challengeId when provided', async () => {
        mockSend.mockResolvedValueOnce({
            Item: { challengeId: '2026-04-11', prompt: 'Test', totalSubmissions: 0 }
        })
        const result = await handler(makeEvent({ localDate: '2026-04-11' }))
        expect(result.statusCode).toBe(200)
        expect(JSON.parse(result.body).challengeId).toBe('2026-04-11')
    })

    it('returns 404 when localDate challenge does not exist', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        const result = await handler(makeEvent({ localDate: '2026-04-11' }))
        expect(result.statusCode).toBe(404)
    })

    it('includes userSubmission when userId is provided and submission exists', async () => {
        mockSend
            .mockResolvedValueOnce({
                Item: { challengeId: '2026-03-15', prompt: 'Cherry Blossom', totalSubmissions: 5 }
            })
            .mockResolvedValueOnce({
                Item: {
                    submittedColor: { h: 10, s: 90, l: 60 },
                    score: 87,
                    submittedAt: '2026-03-15T10:00:00Z',
                    distanceFromAverage: 0.12,
                    averageAtSubmission: { h: 12, s: 88, l: 62 }
                }
            })
        const result = await handler(makeEvent({ userId: 'user123' }))
        expect(result.statusCode).toBe(200)
        const body = JSON.parse(result.body)
        expect(body.userSubmission).not.toBeNull()
        expect(body.userSubmission.score).toBe(87)
    })

    it('sets userSubmission to null when userId provided but no submission', async () => {
        mockSend
            .mockResolvedValueOnce({ Item: { challengeId: '2026-03-15', prompt: 'Cherry Blossom', totalSubmissions: 0 } })
            .mockResolvedValueOnce({ Item: undefined })
        const result = await handler(makeEvent({ userId: 'user123' }))
        expect(result.statusCode).toBe(200)
        expect(JSON.parse(result.body).userSubmission).toBeNull()
    })

    it('returns 500 on unexpected error', async () => {
        mockSend.mockRejectedValueOnce(new Error('DynamoDB down'))
        const result = await handler(makeEvent())
        expect(result.statusCode).toBe(500)
    })
})
