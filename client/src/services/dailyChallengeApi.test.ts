import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DailyChallengeAPI } from './dailyChallengeApi'

const api = new DailyChallengeAPI()

const mockFetch = (body: any, ok = true) => {
    return vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok,
        statusText: ok ? 'OK' : 'Error',
        json: async () => body,
    } as Response)
}

beforeEach(() => {
    vi.restoreAllMocks()
})

describe('DailyChallengeAPI', () => {
    describe('getCurrentChallenge', () => {
        it('returns parsed response on success', async () => {
            const payload = { challengeId: '2026-03-15', prompt: 'Ocean Blue' }
            const spy = mockFetch(payload)
            const result = await api.getCurrentChallenge('user123')
            expect(result).toEqual(payload)
            expect(spy.mock.calls[0][0]).toContain('localDate=')
        })

        it('throws on non-ok response', async () => {
            mockFetch({}, false)
            await expect(api.getCurrentChallenge('user123')).rejects.toThrow('Failed to fetch current challenge')
        })
    })

    describe('getChallengeByDate', () => {
        it('returns parsed response on success', async () => {
            const payload = { challenge: { challengeId: '2026-03-14' }, userSubmission: null }
            mockFetch(payload)
            const result = await api.getChallengeByDate('2026-03-14', 'user123')
            expect(result).toEqual(payload)
        })

        it('throws on non-ok response', async () => {
            mockFetch({}, false)
            await expect(api.getChallengeByDate('2026-03-14', 'user123')).rejects.toThrow('Failed to fetch challenge')
        })
    })

    describe('submitChallenge', () => {
        const submission = {
            challengeId: '2026-03-15',
            userId: 'user123',
            userName: 'Alice',
            color: { h: 180, s: 80, l: 50 },
            fingerprint: 'fp123',
        }

        it('returns parsed response on success', async () => {
            const payload = { success: true, submission: { score: 87 } }
            const spy = mockFetch(payload)
            const result = await api.submitChallenge(submission)
            expect(result).toEqual(payload)
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('/submit'),
                expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } })
            )
        })

        it('throws with server error message on non-ok response', async () => {
            mockFetch({ error: 'Already submitted today' }, false)
            await expect(api.submitChallenge(submission)).rejects.toThrow('Already submitted today')
        })
    })

    describe('getStats', () => {
        it('returns parsed response on success', async () => {
            const payload = { totalSubmissions: 42, averageColor: { h: 180, s: 60, l: 50 } }
            const spy = mockFetch(payload)
            const result = await api.getStats('2026-03-15', 'user123')
            expect(result).toEqual(payload)
            expect(spy.mock.calls[0][0]).toContain('userId=user123')
        })

        it('throws on non-ok response', async () => {
            mockFetch({}, false)
            await expect(api.getStats('2026-03-15', 'user123')).rejects.toThrow('Failed to fetch stats')
        })
    })

    describe('getUserHistory', () => {
        it('returns parsed response on success', async () => {
            const payload = { submissions: [], stats: { totalPlayed: 0 } }
            mockFetch(payload)
            const result = await api.getUserHistory('user123')
            expect(result).toEqual(payload)
        })

        it('uses default limit of 30', async () => {
            const spy = mockFetch({})
            await api.getUserHistory('user123')
            expect(spy.mock.calls[0][0]).toContain('limit=30')
        })

        it('throws on non-ok response', async () => {
            mockFetch({}, false)
            await expect(api.getUserHistory('user123')).rejects.toThrow('Failed to fetch user history')
        })
    })
})
