import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockS3Send } = vi.hoisted(() => ({ mockS3Send: vi.fn() }))

vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: class S3Client { send = mockS3Send },
    PutObjectCommand: class PutObjectCommand {
        [key: string]: any
        constructor(params: any) { Object.assign(this, params) }
    },
}))

import { handler } from './stream-processor'

const makeRecord = (overrides: any = {}) => ({
    eventName: 'INSERT',
    dynamodb: {
        NewImage: {
            userId: { S: 'user123' },
            challengeId: { S: '2026-03-15' },
            userName: { S: 'Alice' },
            submittedColor: { M: { h: { N: '180' }, s: { N: '80' }, l: { N: '50' } } },
            submittedAt: { S: '2026-03-15T10:00:00Z' },
            score: { N: '87' },
            distanceFromAverage: { N: '0.12' },
            ...overrides
        }
    }
})

const makeEvent = (records: any[]) => ({ Records: records }) as any

beforeEach(() => { mockS3Send.mockReset() })

describe('stream-processor handler', () => {
    it('skips non-INSERT events', async () => {
        const event = makeEvent([{ eventName: 'MODIFY', dynamodb: { NewImage: {} } }])
        await handler(event)
        expect(mockS3Send).not.toHaveBeenCalled()
    })

    it('skips records without NewImage', async () => {
        const event = makeEvent([{ eventName: 'INSERT', dynamodb: {} }])
        await handler(event)
        expect(mockS3Send).not.toHaveBeenCalled()
    })

    it('writes a single submission to S3 as NDJSON', async () => {
        mockS3Send.mockResolvedValueOnce({})
        await handler(makeEvent([makeRecord()]))
        expect(mockS3Send).toHaveBeenCalledTimes(1)
        const cmd = mockS3Send.mock.calls[0][0]
        expect(cmd.Key).toMatch(/submissions\/year=2026\/month=03\/day=15\//)
        const parsed = JSON.parse(cmd.Body)
        expect(parsed.userId).toBe('user123')
        expect(parsed.score).toBe(87)
        expect(parsed.submittedColor).toEqual({ h: 180, s: 80, l: 50 })
    })

    it('groups multiple submissions by date and writes separate S3 objects', async () => {
        mockS3Send.mockResolvedValue({})
        const event = makeEvent([
            makeRecord(),
            { ...makeRecord(), dynamodb: { NewImage: { ...makeRecord().dynamodb.NewImage, challengeId: { S: '2026-03-14' } } } },
        ])
        await handler(event)
        expect(mockS3Send).toHaveBeenCalledTimes(2)
    })

    it('writes multiple same-date records as newline-delimited JSON in one S3 object', async () => {
        mockS3Send.mockResolvedValueOnce({})
        const event = makeEvent([
            makeRecord(),
            { ...makeRecord(), dynamodb: { NewImage: { ...makeRecord().dynamodb.NewImage, userId: { S: 'user456' } } } },
        ])
        await handler(event)
        expect(mockS3Send).toHaveBeenCalledTimes(1)
        const body: string = mockS3Send.mock.calls[0][0].Body
        const lines = body.trim().split('\n')
        expect(lines).toHaveLength(2)
        expect(JSON.parse(lines[0]).userId).toBe('user123')
        expect(JSON.parse(lines[1]).userId).toBe('user456')
    })

    it('uses Anonymous for missing userName', async () => {
        mockS3Send.mockResolvedValueOnce({})
        const record = makeRecord()
        delete record.dynamodb.NewImage.userName
        await handler(makeEvent([record]))
        const cmd = mockS3Send.mock.calls[0][0]
        expect(JSON.parse(cmd.Body).userName).toBe('Anonymous')
    })
})
