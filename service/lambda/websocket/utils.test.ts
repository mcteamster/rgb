import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    generateGameId,
    generatePlayerId,
    isValidHSLColor,
    generateRandomHSLColor,
    getCurrentRound,
    findLastSubmittedColor,
    shouldEndGame,
} from './utils'

describe('generateGameId', () => {
    it('returns a 4-character string', () => {
        expect(generateGameId()).toHaveLength(4)
    })

    it('only uses consonants (no vowels)', () => {
        const vowels = /[AEIOU]/i
        for (let i = 0; i < 50; i++) {
            expect(vowels.test(generateGameId())).toBe(false)
        }
    })

    it('uses BC prefix for ap-southeast-2', () => {
        process.env.AWS_REGION = 'ap-southeast-2'
        const id = generateGameId()
        expect(['B', 'C']).toContain(id[3])
    })

    it('uses XZ prefix for unknown region', () => {
        process.env.AWS_REGION = 'unknown-region'
        const id = generateGameId()
        expect(['X', 'Z']).toContain(id[3])
    })
})

describe('generatePlayerId', () => {
    it('returns a non-empty string', () => {
        expect(generatePlayerId().length).toBeGreaterThan(0)
    })

    it('generates different ids on successive calls', () => {
        const ids = new Set(Array.from({ length: 20 }, generatePlayerId))
        expect(ids.size).toBeGreaterThan(15)
    })
})

describe('isValidHSLColor', () => {
    it('accepts valid mid-range color', () => {
        expect(isValidHSLColor({ h: 180, s: 50, l: 50 })).toBe(true)
    })

    it('accepts boundary values', () => {
        expect(isValidHSLColor({ h: 0, s: 0, l: 0 })).toBe(true)
        expect(isValidHSLColor({ h: 360, s: 100, l: 100 })).toBe(true)
    })

    it('rejects hue below 0', () => {
        expect(isValidHSLColor({ h: -1, s: 50, l: 50 })).toBe(false)
    })

    it('rejects hue above 360', () => {
        expect(isValidHSLColor({ h: 361, s: 50, l: 50 })).toBe(false)
    })

    it('rejects saturation below 0', () => {
        expect(isValidHSLColor({ h: 180, s: -1, l: 50 })).toBe(false)
    })

    it('rejects saturation above 100', () => {
        expect(isValidHSLColor({ h: 180, s: 101, l: 50 })).toBe(false)
    })

    it('rejects lightness below 0', () => {
        expect(isValidHSLColor({ h: 180, s: 50, l: -1 })).toBe(false)
    })

    it('rejects lightness above 100', () => {
        expect(isValidHSLColor({ h: 180, s: 50, l: 101 })).toBe(false)
    })
})

describe('generateRandomHSLColor', () => {
    it('always returns a valid HSL color', () => {
        for (let i = 0; i < 100; i++) {
            expect(isValidHSLColor(generateRandomHSLColor())).toBe(true)
        }
    })

    it('saturation is always between 20 and 100', () => {
        for (let i = 0; i < 100; i++) {
            const { s } = generateRandomHSLColor()
            expect(s).toBeGreaterThanOrEqual(20)
            expect(s).toBeLessThanOrEqual(100)
        }
    })

    it('lightness is always between 15 and 85', () => {
        for (let i = 0; i < 100; i++) {
            const { l } = generateRandomHSLColor()
            expect(l).toBeGreaterThanOrEqual(15)
            expect(l).toBeLessThanOrEqual(85)
        }
    })
})

describe('getCurrentRound', () => {
    it('returns null when currentRound is null', () => {
        const game = { meta: { currentRound: null }, gameplay: { rounds: [] } }
        expect(getCurrentRound(game)).toBeNull()
    })

    it('returns null when currentRound is undefined', () => {
        const game = { meta: {}, gameplay: { rounds: [] } }
        expect(getCurrentRound(game)).toBeNull()
    })

    it('returns the correct round at the given index', () => {
        const round0 = { phase: 'describing' }
        const round1 = { phase: 'guessing' }
        const game = { meta: { currentRound: 1 }, gameplay: { rounds: [round0, round1] } }
        expect(getCurrentRound(game)).toBe(round1)
    })

    it('returns null when index is out of bounds', () => {
        const game = { meta: { currentRound: 5 }, gameplay: { rounds: [] } }
        expect(getCurrentRound(game)).toBeNull()
    })
})

describe('findLastSubmittedColor', () => {
    it('returns null when there are no rounds', () => {
        const game = { gameplay: { rounds: [] } }
        expect(findLastSubmittedColor(game, 'player1')).toBeNull()
    })

    it('returns null when player has no submissions', () => {
        const game = {
            gameplay: {
                rounds: [{ submissions: { player2: { h: 100, s: 50, l: 50 } } }]
            }
        }
        expect(findLastSubmittedColor(game, 'player1')).toBeNull()
    })

    it('returns the submission color for the player', () => {
        const color = { h: 200, s: 80, l: 40 }
        const game = {
            gameplay: {
                rounds: [{ submissions: { player1: color } }]
            }
        }
        expect(findLastSubmittedColor(game, 'player1')).toEqual(color)
    })

    it('returns the most recent round submission (searches from last round)', () => {
        const oldColor = { h: 100, s: 50, l: 50 }
        const newColor = { h: 200, s: 80, l: 40 }
        const game = {
            gameplay: {
                rounds: [
                    { submissions: { player1: oldColor } },
                    { submissions: {} },
                    { submissions: { player1: newColor } },
                ]
            }
        }
        expect(findLastSubmittedColor(game, 'player1')).toEqual(newColor)
    })
})

describe('shouldEndGame', () => {
    const makeGame = (turnsPerPlayer: number, rounds: any[], players: any[]) => ({
        config: { turnsPerPlayer },
        players,
        gameplay: { rounds }
    })

    const players = [
        { playerId: 'p1', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z' },
        { playerId: 'p2', playerName: 'Bob', joinedAt: '2024-01-01T00:00:01Z' }
    ]

    it('returns false when no rounds have been played', () => {
        const game = makeGame(2, [], players)
        expect(shouldEndGame(game)).toBe(false)
    })

    it('returns false when players have not yet reached turnsPerPlayer', () => {
        const game = makeGame(2, [
            { describerId: 'p1' },
            { describerId: 'p2' },
        ], players)
        expect(shouldEndGame(game)).toBe(false)
    })

    it('returns true when all players have reached turnsPerPlayer', () => {
        const game = makeGame(2, [
            { describerId: 'p1' },
            { describerId: 'p2' },
            { describerId: 'p1' },
            { describerId: 'p2' },
        ], players)
        expect(shouldEndGame(game)).toBe(true)
    })

    it('returns false when only one player has reached turnsPerPlayer', () => {
        const game = makeGame(2, [
            { describerId: 'p1' },
            { describerId: 'p1' },
        ], players)
        expect(shouldEndGame(game)).toBe(false)
    })

    it('returns true with turnsPerPlayer = 1 after one round each', () => {
        const game = makeGame(1, [
            { describerId: 'p1' },
            { describerId: 'p2' },
        ], players)
        expect(shouldEndGame(game)).toBe(true)
    })
})
