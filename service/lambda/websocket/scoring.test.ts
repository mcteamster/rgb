import { describe, it, expect } from 'vitest'
import { geometricNormalScoring } from './scoring'

describe('geometricNormalScoring', () => {
    describe('perfect match', () => {
        it('returns 100 for identical colors', () => {
            expect(geometricNormalScoring(
                { h: 180, s: 80, l: 50 },
                { h: 180, s: 80, l: 50 }
            )).toBe(100)
        })

        it('returns 100 for identical colors at different hues', () => {
            expect(geometricNormalScoring(
                { h: 0, s: 50, l: 50 },
                { h: 0, s: 50, l: 50 }
            )).toBe(100)
        })
    })

    describe('hue wrapping', () => {
        it('treats hue 5° and 355° as close (10° apart, not 350°)', () => {
            const score = geometricNormalScoring(
                { h: 5, s: 50, l: 50 },
                { h: 355, s: 50, l: 50 }
            )
            expect(score).toBeGreaterThan(90)
        })

        it('treats hue 0° and 180° as far apart', () => {
            const score = geometricNormalScoring(
                { h: 0, s: 50, l: 50 },
                { h: 180, s: 50, l: 50 }
            )
            expect(score).toBe(0)
        })
    })

    describe('3-sigma cutoff', () => {
        it('returns 0 when hue diff exceeds 3-sigma (75°)', () => {
            expect(geometricNormalScoring(
                { h: 0, s: 50, l: 50 },
                { h: 80, s: 50, l: 50 }
            )).toBe(0)
        })

        it('returns 0 when saturation diff exceeds 3-sigma (75%)', () => {
            expect(geometricNormalScoring(
                { h: 0, s: 0, l: 50 },
                { h: 0, s: 80, l: 50 }
            )).toBe(0)
        })

        it('returns 0 when lightness diff exceeds 3-sigma', () => {
            // At l=50, lightnessSigma = 15 * (50/50) = 15, 3-sigma = 45
            expect(geometricNormalScoring(
                { h: 0, s: 50, l: 50 },
                { h: 0, s: 50, l: 99 }
            )).toBe(0)
        })
    })

    describe('extreme lightness hue tolerance', () => {
        it('scores higher for a hue miss at very dark lightness than at mid lightness', () => {
            const hueDiff = 40 // Beyond standard 3-sigma (75°) but within adjusted
            const darkScore = geometricNormalScoring(
                { h: 0, s: 50, l: 5 },
                { h: hueDiff, s: 50, l: 5 }
            )
            const midScore = geometricNormalScoring(
                { h: 0, s: 50, l: 50 },
                { h: hueDiff, s: 50, l: 50 }
            )
            expect(darkScore).toBeGreaterThan(midScore)
        })

        it('scores higher for a hue miss at very bright lightness than at mid lightness', () => {
            const hueDiff = 40
            const brightScore = geometricNormalScoring(
                { h: 0, s: 50, l: 95 },
                { h: hueDiff, s: 50, l: 95 }
            )
            const midScore = geometricNormalScoring(
                { h: 0, s: 50, l: 50 },
                { h: hueDiff, s: 50, l: 50 }
            )
            expect(brightScore).toBeGreaterThan(midScore)
        })
    })

    describe('score ordering', () => {
        it('closer hue guess scores higher than farther hue guess', () => {
            const target = { h: 180, s: 80, l: 50 }
            const close = geometricNormalScoring(target, { h: 185, s: 80, l: 50 })
            const far = geometricNormalScoring(target, { h: 210, s: 80, l: 50 })
            expect(close).toBeGreaterThan(far)
        })

        it('score is never negative', () => {
            expect(geometricNormalScoring(
                { h: 0, s: 0, l: 0 },
                { h: 180, s: 100, l: 100 }
            )).toBeGreaterThanOrEqual(0)
        })

        it('score is never above 100', () => {
            expect(geometricNormalScoring(
                { h: 180, s: 80, l: 50 },
                { h: 180, s: 80, l: 50 }
            )).toBeLessThanOrEqual(100)
        })
    })
})
