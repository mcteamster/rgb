import { describe, it, expect } from 'vitest'
import { calculatePlayerRankings, findHostPlayer } from './gameUtils'
import { Player } from '../types/game'

const makePlayer = (id: string, score: number, joinedAt: string): Player => ({
    playerId: id,
    playerName: id,
    score,
    joinedAt,
    draftColor: { h: 0, s: 0, l: 0 },
})

describe('findHostPlayer', () => {
    it('returns null for empty array', () => {
        expect(findHostPlayer([])).toBeNull()
    })

    it('returns the only player', () => {
        const p = makePlayer('p1', 0, '2024-01-01T00:00:00Z')
        expect(findHostPlayer([p])).toBe(p)
    })

    it('returns the player with the earliest joinedAt', () => {
        const early = makePlayer('early', 0, '2024-01-01T00:00:00Z')
        const late = makePlayer('late', 0, '2024-01-01T00:01:00Z')
        expect(findHostPlayer([late, early])?.playerId).toBe('early')
    })
})

describe('calculatePlayerRankings', () => {
    it('ranks a single player as 1', () => {
        const rankings = calculatePlayerRankings([makePlayer('p1', 100, '2024-01-01T00:00:00Z')])
        expect(rankings['p1']).toBe(1)
    })

    it('ranks players by descending score', () => {
        const players = [
            makePlayer('p1', 50, '2024-01-01T00:00:00Z'),
            makePlayer('p2', 100, '2024-01-01T00:00:01Z'),
            makePlayer('p3', 75, '2024-01-01T00:00:02Z'),
        ]
        const rankings = calculatePlayerRankings(players)
        expect(rankings['p2']).toBe(1)
        expect(rankings['p3']).toBe(2)
        expect(rankings['p1']).toBe(3)
    })

    it('assigns the same rank to tied players', () => {
        const players = [
            makePlayer('p1', 80, '2024-01-01T00:00:00Z'),
            makePlayer('p2', 80, '2024-01-01T00:00:01Z'),
            makePlayer('p3', 60, '2024-01-01T00:00:02Z'),
        ]
        const rankings = calculatePlayerRankings(players)
        expect(rankings['p1']).toBe(1)
        expect(rankings['p2']).toBe(1)
        expect(rankings['p3']).toBe(3)
    })

    it('treats undefined score as 0', () => {
        const player = { playerId: 'p1', playerName: 'A', joinedAt: '2024-01-01T00:00:00Z', draftColor: { h: 0, s: 0, l: 0 } } as Player
        const rankings = calculatePlayerRankings([player])
        expect(rankings['p1']).toBe(1)
    })
})
