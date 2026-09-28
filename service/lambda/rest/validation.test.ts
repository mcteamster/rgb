import { describe, it, expect } from 'vitest'
import { validateUserId, USER_ID_MIN, USER_ID_MAX } from './validation'

describe('validateUserId', () => {
    // ── Valid inputs ──────────────────────────────────────────────────────────

    it('returns trimmed value for a valid mid-length id', () => {
        expect(validateUserId('user-abc123')).toBe('user-abc123')
    })

    it('accepts an id at exactly the minimum length', () => {
        const minId = 'a'.repeat(USER_ID_MIN)
        expect(validateUserId(minId)).toBe(minId)
    })

    it('accepts an id at exactly the maximum length', () => {
        const maxId = 'a'.repeat(USER_ID_MAX)
        expect(validateUserId(maxId)).toBe(maxId)
    })

    it('accepts ids with all allowed charset chars: alphanumeric, dot, underscore, hyphen', () => {
        expect(validateUserId('Ab1.cd_ef-gh')).toBe('Ab1.cd_ef-gh')
    })

    it('trims leading/trailing whitespace and returns the trimmed value when valid', () => {
        const trimmed = 'a'.repeat(USER_ID_MIN)
        expect(validateUserId(`  ${trimmed}  `)).toBe(trimmed)
    })

    // ── Length boundary rejections ────────────────────────────────────────────

    it('rejects an id one character below the minimum length', () => {
        expect(validateUserId('a'.repeat(USER_ID_MIN - 1))).toBeNull()
    })

    it('rejects an id one character above the maximum length', () => {
        expect(validateUserId('a'.repeat(USER_ID_MAX + 1))).toBeNull()
    })

    it('rejects an empty string', () => {
        expect(validateUserId('')).toBeNull()
    })

    it('rejects a whitespace-only string', () => {
        expect(validateUserId('   ')).toBeNull()
    })

    // ── Charset rejections ────────────────────────────────────────────────────

    it('rejects an id containing an internal space', () => {
        expect(validateUserId('user 12345678')).toBeNull()
    })

    it('rejects an id containing a tab character', () => {
        expect(validateUserId('user\t12345678')).toBeNull()
    })

    it('rejects an id containing a newline character', () => {
        expect(validateUserId('user\n12345678')).toBeNull()
    })

    it('rejects an id containing a null byte (control char)', () => {
        expect(validateUserId('user\x0012345')).toBeNull()
    })

    it('rejects an id containing a forward slash (path metachar)', () => {
        expect(validateUserId('user/12345678')).toBeNull()
    })

    it('rejects an id containing a colon (expression metachar)', () => {
        expect(validateUserId('user:12345678')).toBeNull()
    })

    it('rejects an id containing square brackets', () => {
        expect(validateUserId('user[12345678')).toBeNull()
    })

    it('rejects an id containing a hash character', () => {
        expect(validateUserId('user#12345678')).toBeNull()
    })

    it('rejects an id that after trimming remains below min length', () => {
        // 5 chars of padding on each side, but core is only 3 chars — below min
        expect(validateUserId('     abc     ')).toBeNull()
    })

    // ── Non-string input rejections ───────────────────────────────────────────

    it('rejects null', () => {
        expect(validateUserId(null)).toBeNull()
    })

    it('rejects undefined', () => {
        expect(validateUserId(undefined)).toBeNull()
    })

    it('rejects a number', () => {
        expect(validateUserId(12345678)).toBeNull()
    })

    it('rejects an object', () => {
        expect(validateUserId({ id: 'user12345' })).toBeNull()
    })

    it('rejects an array', () => {
        expect(validateUserId(['user12345'])).toBeNull()
    })
})
