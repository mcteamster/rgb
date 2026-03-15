import { describe, it, expect } from 'vitest'
import { getOrdinalSuffix, formatTimeRemaining } from './formatUtils'

describe('getOrdinalSuffix', () => {
    it('returns st for 1', () => expect(getOrdinalSuffix(1)).toBe('st'))
    it('returns nd for 2', () => expect(getOrdinalSuffix(2)).toBe('nd'))
    it('returns rd for 3', () => expect(getOrdinalSuffix(3)).toBe('rd'))
    it('returns th for 4', () => expect(getOrdinalSuffix(4)).toBe('th'))
    it('returns th for 11', () => expect(getOrdinalSuffix(11)).toBe('th'))
    it('returns th for 20', () => expect(getOrdinalSuffix(20)).toBe('th'))
})

describe('formatTimeRemaining', () => {
    it('returns 0s for 0', () => expect(formatTimeRemaining(0)).toBe('0s'))
    it('returns 0s for negative', () => expect(formatTimeRemaining(-5)).toBe('0s'))
    it('returns seconds only for < 60', () => expect(formatTimeRemaining(45)).toBe('45s'))
    it('returns minutes only when no remainder', () => expect(formatTimeRemaining(120)).toBe('2m'))
    it('returns minutes and seconds when remainder', () => expect(formatTimeRemaining(90)).toBe('1m 30s'))
    it('returns 1m for exactly 60', () => expect(formatTimeRemaining(60)).toBe('1m'))
})
