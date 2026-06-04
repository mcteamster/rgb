// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'

const store: Record<string, string> = {}
const localStorageMock = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

import { getUserId, getUserName, setUserName, generateFingerprint } from './userId'

beforeEach(() => {
    localStorageMock.clear()
})

describe('getUserId', () => {
    it('generates and stores an id when none exists', () => {
        const id = getUserId()
        expect(id).toMatch(/^anon_/)
        expect(localStorage.getItem('rgb-daily-user-id')).toBe(id)
    })

    it('returns the same id on subsequent calls', () => {
        const first = getUserId()
        const second = getUserId()
        expect(second).toBe(first)
    })
})

describe('getUserName', () => {
    it('returns empty string when not set', () => {
        expect(getUserName()).toBe('')
    })

    it('returns the stored name', () => {
        localStorage.setItem('rgb-daily-user-name', 'Alice')
        expect(getUserName()).toBe('Alice')
    })
})

describe('setUserName', () => {
    it('persists the name to localStorage', () => {
        setUserName('Bob')
        expect(localStorage.getItem('rgb-daily-user-name')).toBe('Bob')
        expect(getUserName()).toBe('Bob')
    })
})

describe('generateFingerprint', () => {
    it('returns a non-empty string', () => {
        expect(generateFingerprint().length).toBeGreaterThan(0)
    })

    it('returns at most 32 characters', () => {
        expect(generateFingerprint().length).toBeLessThanOrEqual(32)
    })

    it('returns the same value on successive calls in the same environment', () => {
        expect(generateFingerprint()).toBe(generateFingerprint())
    })
})
