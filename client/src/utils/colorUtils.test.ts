import { describe, it, expect } from 'vitest'
import {
    convertToServerColor,
    convertToClientColor,
    hslToRgb,
    calculateSaturationFromAngle,
    calculateAngleFromSaturation,
    calculateLightnessFromDistance,
    calculateDistanceFromLightness,
    cartesianToPolar,
} from './colorUtils'

describe('convertToServerColor', () => {
    it('rounds fractional values', () => {
        expect(convertToServerColor({ h: 180.6, s: 50.4, l: 49.9 })).toEqual({ h: 181, s: 50, l: 50 })
    })

    it('passes through integer values unchanged', () => {
        const color = { h: 120, s: 80, l: 40 }
        expect(convertToServerColor(color)).toEqual(color)
    })
})

describe('convertToClientColor', () => {
    it('rounds fractional values', () => {
        expect(convertToClientColor({ h: 180.6, s: 50.4, l: 49.9 })).toEqual({ h: 181, s: 50, l: 50 })
    })

    it('passes through integer values unchanged', () => {
        const color = { h: 120, s: 80, l: 40 }
        expect(convertToClientColor(color)).toEqual(color)
    })
})

describe('hslToRgb', () => {
    it('converts red (h=0)', () => expect(hslToRgb(0, 100, 50)).toEqual([255, 0, 0]))
    it('converts yellow (h=60)', () => expect(hslToRgb(60, 100, 50)).toEqual([255, 255, 0]))
    it('converts green (h=120)', () => expect(hslToRgb(120, 100, 50)).toEqual([0, 255, 0]))
    it('converts cyan (h=180)', () => expect(hslToRgb(180, 100, 50)).toEqual([0, 255, 255]))
    it('converts blue (h=240)', () => expect(hslToRgb(240, 100, 50)).toEqual([0, 0, 255]))
    it('converts magenta (h=300)', () => expect(hslToRgb(300, 100, 50)).toEqual([255, 0, 255]))
    it('converts white (s=0, l=100)', () => expect(hslToRgb(0, 0, 100)).toEqual([255, 255, 255]))
    it('converts black (l=0)', () => expect(hslToRgb(0, 0, 0)).toEqual([0, 0, 0]))
    it('converts grey (s=0, l=50)', () => expect(hslToRgb(0, 0, 50)).toEqual([128, 128, 128]))
})

// Note: round-trips only work for angles in [-90°, 90°] — asin() can't recover angles outside that range
describe('calculateSaturationFromAngle / calculateAngleFromSaturation round-trip', () => {
    it('round-trips 0°', () => {
        const s = calculateSaturationFromAngle(0)
        expect(calculateAngleFromSaturation(s)).toBeCloseTo(0, 1)
    })

    it('round-trips 90°', () => {
        const s = calculateSaturationFromAngle(90)
        expect(calculateAngleFromSaturation(s)).toBeCloseTo(90, 1)
    })

    it('round-trips 45°', () => {
        const s = calculateSaturationFromAngle(45)
        expect(calculateAngleFromSaturation(s)).toBeCloseTo(45, 1)
    })

    it('returns saturation between 0 and 100', () => {
        expect(calculateSaturationFromAngle(45)).toBeGreaterThanOrEqual(0)
        expect(calculateSaturationFromAngle(45)).toBeLessThanOrEqual(100)
    })
})

describe('calculateLightnessFromDistance / calculateDistanceFromLightness', () => {
    it('center (0) maps to 100% lightness', () => {
        expect(calculateLightnessFromDistance(0)).toBeCloseTo(100)
    })

    it('edge (1) maps to 0% lightness', () => {
        expect(calculateLightnessFromDistance(1)).toBeCloseTo(0)
    })

    it('mid-radius maps to mid lightness range', () => {
        const l = calculateLightnessFromDistance(0.5)
        expect(l).toBeGreaterThan(15)
        expect(l).toBeLessThan(85)
    })

    it('first zone boundary (0.01) maps to ~85% lightness', () => {
        expect(calculateLightnessFromDistance(0.01)).toBeCloseTo(85)
    })

    it('last zone boundary (0.99) maps to ~15% lightness', () => {
        expect(calculateLightnessFromDistance(0.99)).toBeCloseTo(15)
    })

    it('round-trips distance through lightness and back', () => {
        [0.05, 0.3, 0.5, 0.7, 0.95].forEach(d => {
            expect(calculateDistanceFromLightness(calculateLightnessFromDistance(d))).toBeCloseTo(d, 5)
        })
    })
})

describe('cartesianToPolar', () => {
    it('point to the right has angle 0', () => {
        const { angle } = cartesianToPolar(200, 100, 100)
        expect(angle).toBeCloseTo(0)
    })

    it('point below has angle 90', () => {
        const { angle } = cartesianToPolar(100, 200, 100)
        expect(angle).toBeCloseTo(90)
    })

    it('point to the left has angle 180', () => {
        const { angle } = cartesianToPolar(0, 100, 100)
        expect(angle).toBeCloseTo(180)
    })

    it('point above has angle 270', () => {
        const { angle } = cartesianToPolar(100, 0, 100)
        expect(angle).toBeCloseTo(270)
    })

    it('calculates correct distance from center', () => {
        const { distance } = cartesianToPolar(200, 100, 100)
        expect(distance).toBeCloseTo(100)
    })
})
