import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class DynamoDBClient {} }))
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    GetCommand: vi.fn(),
    PutCommand: vi.fn(),
    UpdateCommand: vi.fn(),
}))

import { handler } from './submit-challenge'

const validBody = {
    challengeId: '2026-03-15',
    userId: 'user-12345',
    userName: 'Alice',
    color: { h: 180, s: 80, l: 50 },
    fingerprint: 'fp123',
}

const makeEvent = (body?: any) => ({
    body: body !== undefined ? JSON.stringify(body) : null,
}) as any

const todayChallenge = {
    challengeId: '2026-03-15',
    prompt: 'Cherry Blossom',
    status: 'active',
    totalSubmissions: 0,
}

beforeEach(() => {
    mockSend.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))
})
afterEach(() => { vi.useRealTimers() })

describe('submit-challenge handler', () => {
    describe('input validation', () => {
        it('returns 400 when body is missing', async () => {
            const result = await handler(makeEvent())
            expect(result.statusCode).toBe(400)
        })

        it('returns 400 when challengeId is missing', async () => {
            const result = await handler(makeEvent({ ...validBody, challengeId: undefined }))
            expect(result.statusCode).toBe(400)
        })

        it('returns 400 when userId is missing', async () => {
            const result = await handler(makeEvent({ ...validBody, userId: undefined }))
            expect(result.statusCode).toBe(400)
        })

        it('returns 400 for malformed userId and does not issue a PutCommand', async () => {
            const result = await handler(makeEvent({ ...validBody, userId: 'bad!id' }))
            expect(result.statusCode).toBe(400)
            expect(JSON.parse(result.body).error).toBe('Invalid userId')
            expect(mockSend).not.toHaveBeenCalled()
        })

        it('returns 400 for a userId that is too short and does not issue a PutCommand', async () => {
            const result = await handler(makeEvent({ ...validBody, userId: 'short' }))
            expect(result.statusCode).toBe(400)
            expect(JSON.parse(result.body).error).toBe('Invalid userId')
            expect(mockSend).not.toHaveBeenCalled()
        })

        it('trims whitespace from userId and stores the trimmed value', async () => {
            const paddedId = '  user-12345  '
            const trimmedId = 'user-12345'
            mockSend
                .mockResolvedValueOnce({ Item: { challengeId: '2026-03-15', totalSubmissions: 0 } })
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
            // Capture the PutCommand constructor argument to verify the stored userId
            const { PutCommand } = await import('@aws-sdk/lib-dynamodb')
            const PutCommandMock = PutCommand as unknown as ReturnType<typeof vi.fn>
            PutCommandMock.mockClear()
            const result = await handler(makeEvent({ ...validBody, userId: paddedId }))
            expect(result.statusCode).toBe(200)
            // PutCommand was called with the trimmed id as the partition key
            const putCallArgs = PutCommandMock.mock.calls[0]?.[0]
            expect(putCallArgs?.Item?.userId).toBe(trimmedId)
        })

        it('returns 400 when color is missing', async () => {
            const result = await handler(makeEvent({ ...validBody, color: undefined }))
            expect(result.statusCode).toBe(400)
        })

        it('returns 400 for hue out of range', async () => {
            const result = await handler(makeEvent({ ...validBody, color: { h: 400, s: 50, l: 50 } }))
            expect(result.statusCode).toBe(400)
        })

        it('returns 400 for non-finite color values', async () => {
            const result = await handler(makeEvent({ ...validBody, color: { h: NaN, s: 50, l: 50 } }))
            expect(result.statusCode).toBe(400)
        })

        it('returns 400 for userName exceeding 50 characters', async () => {
            const result = await handler(makeEvent({ ...validBody, userName: 'x'.repeat(51) }))
            expect(result.statusCode).toBe(400)
        })
    })

    describe('business logic', () => {
        it('returns 404 when challenge does not exist', async () => {
            mockSend.mockResolvedValueOnce({ Item: undefined })
            const result = await handler(makeEvent(validBody))
            expect(result.statusCode).toBe(404)
        })

        it('returns 410 for a challenge older than 30 days', async () => {
            mockSend.mockResolvedValueOnce({ Item: { ...todayChallenge, challengeId: '2020-01-01' } })
            const result = await handler(makeEvent({ ...validBody, challengeId: '2020-01-01' }))
            expect(result.statusCode).toBe(410)
        })

        it('allows submission at the Baker Island 30-day boundary', async () => {
            // System time: 2026-03-15T12:00:00Z (noon UTC)
            // Baker Island (UTC-12): 2026-03-15T00:00:00 → date = March 15
            // 30 days before = Feb 13 → challenge 2026-02-13 should still be allowed
            vi.useFakeTimers()
            vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))
            mockSend
                .mockResolvedValueOnce({ Item: { ...todayChallenge, challengeId: '2026-02-13' } })
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
            const result = await handler(makeEvent({ ...validBody, challengeId: '2026-02-13' }))
            expect(result.statusCode).toBe(200)
        })

        it('returns 400 for duplicate submission (ConditionalCheckFailedException)', async () => {
            mockSend.mockResolvedValueOnce({ Item: todayChallenge })
            const error = Object.assign(new Error('Duplicate'), { name: 'ConditionalCheckFailedException' })
            mockSend.mockRejectedValueOnce(error)
            const result = await handler(makeEvent(validBody))
            expect(result.statusCode).toBe(400)
            expect(JSON.parse(result.body).error).toContain('already submitted')
        })

        it('returns 200 with score 100 for first submission', async () => {
            mockSend
                .mockResolvedValueOnce({ Item: todayChallenge }) // GetCommand: challenge
                .mockResolvedValueOnce({})                        // PutCommand: store submission
                .mockResolvedValueOnce({})                        // UpdateCommand: update challenge
            const result = await handler(makeEvent(validBody))
            expect(result.statusCode).toBe(200)
            const body = JSON.parse(result.body)
            expect(body.success).toBe(true)
            expect(body.submission.score).toBe(100)
            expect(body.submission.distanceFromAverage).toBe(0)
        })

        it('returns 200 and calculates score for subsequent submissions', async () => {
            const challengeWithAverage = {
                ...todayChallenge,
                totalSubmissions: 5,
                averageColor: { h: 175, s: 75, l: 48 },
            }
            mockSend
                .mockResolvedValueOnce({ Item: challengeWithAverage })
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
            const result = await handler(makeEvent(validBody))
            expect(result.statusCode).toBe(200)
            const body = JSON.parse(result.body)
            expect(body.submission.score).toBeGreaterThanOrEqual(0)
            expect(body.submission.score).toBeLessThanOrEqual(100)
        })

        it('returns 500 on unexpected error', async () => {
            mockSend.mockRejectedValueOnce(new Error('Unexpected'))
            const result = await handler(makeEvent(validBody))
            expect(result.statusCode).toBe(500)
        })
    })
})
