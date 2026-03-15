import { describe, it, expect } from 'vitest'
import {
    hslToBiconeCartesian,
    biconeCartesianToHSL,
    calculateAverageColor,
    distanceFromAverageScoring,
    updateAverageColor,
} from './scoring'

describe('hslToBiconeCartesian', () => {
    it('maps black (L=0) to bottom of bicone', () => {
        const result = hslToBiconeCartesian({ h: 0, s: 0, l: 0 })
        expect(result.z).toBeCloseTo(-1)
        expect(result.x).toBeCloseTo(0)
        expect(result.y).toBeCloseTo(0)
    })

    it('maps white (L=100) to top of bicone', () => {
        const result = hslToBiconeCartesian({ h: 0, s: 0, l: 100 })
        expect(result.z).toBeCloseTo(1)
        expect(result.x).toBeCloseTo(0)
        expect(result.y).toBeCloseTo(0)
    })

    it('maps mid gray (L=50, S=0) to origin', () => {
        const result = hslToBiconeCartesian({ h: 0, s: 0, l: 50 })
        expect(result.x).toBeCloseTo(0)
        expect(result.y).toBeCloseTo(0)
        expect(result.z).toBeCloseTo(0)
    })

    it('maps pure red (H=0, S=100, L=50) to positive x-axis', () => {
        const result = hslToBiconeCartesian({ h: 0, s: 100, l: 50 })
        expect(result.x).toBeCloseTo(1)
        expect(result.y).toBeCloseTo(0)
        expect(result.z).toBeCloseTo(0)
    })

    it('maps pure cyan (H=180, S=100, L=50) to negative x-axis', () => {
        const result = hslToBiconeCartesian({ h: 180, s: 100, l: 50 })
        expect(result.x).toBeCloseTo(-1)
        expect(result.y).toBeCloseTo(0)
        expect(result.z).toBeCloseTo(0)
    })

    it('radius shrinks as lightness approaches extremes', () => {
        const mid = hslToBiconeCartesian({ h: 0, s: 100, l: 50 })
        const dark = hslToBiconeCartesian({ h: 0, s: 100, l: 10 })
        const midRadius = Math.sqrt(mid.x ** 2 + mid.y ** 2)
        const darkRadius = Math.sqrt(dark.x ** 2 + dark.y ** 2)
        expect(midRadius).toBeGreaterThan(darkRadius)
    })
})

describe('biconeCartesianToHSL', () => {
    it('round-trips red back to red', () => {
        const original = { h: 0, s: 100, l: 50 }
        const cart = hslToBiconeCartesian(original)
        const result = biconeCartesianToHSL(cart)
        expect(result.h).toBeCloseTo(original.h, 1)
        expect(result.s).toBeCloseTo(original.s, 1)
        expect(result.l).toBeCloseTo(original.l, 1)
    })

    it('round-trips an arbitrary mid-range color', () => {
        const original = { h: 210, s: 60, l: 45 }
        const cart = hslToBiconeCartesian(original)
        const result = biconeCartesianToHSL(cart)
        expect(result.h).toBeCloseTo(original.h, 1)
        expect(result.s).toBeCloseTo(original.s, 1)
        expect(result.l).toBeCloseTo(original.l, 1)
    })

    it('maps origin back to mid gray', () => {
        const result = biconeCartesianToHSL({ x: 0, y: 0, z: 0 })
        expect(result.l).toBeCloseTo(50)
        expect(result.s).toBe(0)
    })

    it('clamps saturation to 100 at bicone boundary', () => {
        const result = biconeCartesianToHSL({ x: 1, y: 0, z: 0 })
        expect(result.s).toBeLessThanOrEqual(100)
    })
})

describe('calculateAverageColor', () => {
    it('returns gray fallback for empty array', () => {
        const result = calculateAverageColor([])
        expect(result).toEqual({ h: 0, s: 0, l: 50 })
    })

    it('returns the single color unchanged', () => {
        const color = { h: 120, s: 75, l: 40 }
        expect(calculateAverageColor([color])).toEqual(color)
    })

    it('averages two identical colors to the same color', () => {
        const color = { h: 90, s: 50, l: 50 }
        const result = calculateAverageColor([color, color])
        expect(result.h).toBeCloseTo(color.h, 1)
        expect(result.s).toBeCloseTo(color.s, 1)
        expect(result.l).toBeCloseTo(color.l, 1)
    })

    it('averages opposite hues (red + cyan) to a neutral gray', () => {
        // Red: (1, 0, 0) and Cyan: (-1, 0, 0) → centroid (0, 0, 0) → gray
        const result = calculateAverageColor([
            { h: 0, s: 100, l: 50 },
            { h: 180, s: 100, l: 50 },
        ])
        expect(result.s).toBeCloseTo(0, 1)
        expect(result.l).toBeCloseTo(50, 1)
    })

    it('averages black and white to mid gray', () => {
        const result = calculateAverageColor([
            { h: 0, s: 0, l: 0 },
            { h: 0, s: 0, l: 100 },
        ])
        expect(result.l).toBeCloseTo(50, 1)
    })

    it('averages lightness correctly across multiple colors', () => {
        const result = calculateAverageColor([
            { h: 0, s: 0, l: 20 },
            { h: 0, s: 0, l: 40 },
            { h: 0, s: 0, l: 60 },
            { h: 0, s: 0, l: 80 },
        ])
        expect(result.l).toBeCloseTo(50, 1)
    })
})

describe('distanceFromAverageScoring', () => {
    it('scores 100 for identical colors', () => {
        const color = { h: 180, s: 80, l: 50 }
        const { score, distance } = distanceFromAverageScoring(color, color)
        expect(score).toBe(100)
        expect(distance).toBeCloseTo(0)
    })

    it('scores 0 for maximally distant colors (red vs cyan)', () => {
        // Distance = 2, maxDistance = √2 → normalized > 1 → clamped to 1 → score 0
        const { score } = distanceFromAverageScoring(
            { h: 0, s: 100, l: 50 },
            { h: 180, s: 100, l: 50 }
        )
        expect(score).toBe(0)
    })

    it('closer color scores higher than farther color', () => {
        const average = { h: 180, s: 80, l: 50 }
        const { score: closeScore } = distanceFromAverageScoring({ h: 185, s: 78, l: 51 }, average)
        const { score: farScore } = distanceFromAverageScoring({ h: 0, s: 50, l: 80 }, average)
        expect(closeScore).toBeGreaterThan(farScore)
    })

    it('score is always between 0 and 100', () => {
        const { score } = distanceFromAverageScoring(
            { h: 45, s: 30, l: 70 },
            { h: 200, s: 90, l: 20 }
        )
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(100)
    })

    it('distance is always non-negative', () => {
        const { distance } = distanceFromAverageScoring(
            { h: 90, s: 60, l: 40 },
            { h: 270, s: 40, l: 60 }
        )
        expect(distance).toBeGreaterThanOrEqual(0)
    })
})

describe('updateAverageColor', () => {
    it('returns newColor as average when count is 0', () => {
        const newColor = { h: 120, s: 60, l: 50 }
        const { averageColor } = updateAverageColor({ h: 0, s: 0, l: 50 }, 0, newColor)
        expect(averageColor).toEqual(newColor)
    })

    it('initialises stats correctly on first submission', () => {
        const newColor = { h: 120, s: 60, l: 50 }
        const { stats } = updateAverageColor({ h: 0, s: 0, l: 50 }, 0, newColor)
        expect(stats.h.mean).toBe(newColor.h)
        expect(stats.s.mean).toBe(newColor.s)
        expect(stats.l.mean).toBe(newColor.l)
        expect(stats.h.m2).toBe(0)
    })

    it('converges toward the new color on second submission', () => {
        const first = { h: 0, s: 100, l: 50 }
        const second = { h: 180, s: 100, l: 50 }
        const { averageColor } = updateAverageColor(first, 1, second)
        // Average of red and cyan in bicone = neutral gray
        expect(averageColor.s).toBeCloseTo(0, 1)
        expect(averageColor.l).toBeCloseTo(50, 1)
    })

    it('produces the same result as calculateAverageColor for two colors', () => {
        const first = { h: 60, s: 80, l: 40 }
        const second = { h: 240, s: 40, l: 60 }
        const { averageColor: incremental } = updateAverageColor(first, 1, second)
        const batch = calculateAverageColor([first, second])
        expect(incremental.h).toBeCloseTo(batch.h, 1)
        expect(incremental.s).toBeCloseTo(batch.s, 1)
        expect(incremental.l).toBeCloseTo(batch.l, 1)
    })
})
