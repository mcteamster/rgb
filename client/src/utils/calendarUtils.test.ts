import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildMonthGroups } from './calendarUtils';

afterEach(() => {
    vi.useRealTimers();
});

describe('buildMonthGroups', () => {
    it('returns exactly 30 active days', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-15T10:00:00'));
        const groups = buildMonthGroups();
        const activeDays = groups.flatMap(g => g.days.filter(d => d.type === 'active'));
        expect(activeDays).toHaveLength(30);
    });

    it('marks exactly one day as today', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-15T10:00:00'));
        const groups = buildMonthGroups();
        const todayDays = groups.flatMap(g => g.days).filter(d => d.type === 'active' && d.isToday);
        expect(todayDays).toHaveLength(1);
    });

    it('today marker date matches local date, not UTC date', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-15T10:00:00'));
        const groups = buildMonthGroups();
        const todayDay = groups.flatMap(g => g.days).find(d => d.type === 'active' && d.isToday);
        const localDate = new Date().toLocaleDateString('en-CA');
        expect(todayDay?.date).toBe(localDate);
    });

    it('last active day is today', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-15T10:00:00'));
        const groups = buildMonthGroups();
        const activeDays = groups.flatMap(g => g.days.filter(d => d.type === 'active' && d.date));
        const localDate = new Date().toLocaleDateString('en-CA');
        expect(activeDays[activeDays.length - 1].date).toBe(localDate);
    });

    it('first active day is 29 days before today', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-15T10:00:00'));
        const groups = buildMonthGroups();
        const activeDays = groups.flatMap(g => g.days.filter(d => d.type === 'active' && d.date));
        const expectedFirst = new Date();
        expectedFirst.setDate(expectedFirst.getDate() - 29);
        expect(activeDays[0].date).toBe(expectedFirst.toLocaleDateString('en-CA'));
    });

    it('all active dates are valid YYYY-MM-DD strings', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-15T10:00:00'));
        const groups = buildMonthGroups();
        const dates = groups.flatMap(g => g.days.filter(d => d.type === 'active' && d.date).map(d => d.date!));
        for (const date of dates) {
            expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
    });

    it('active dates are consecutive calendar days', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-15T10:00:00'));
        const groups = buildMonthGroups();
        const dates = groups.flatMap(g => g.days.filter(d => d.type === 'active' && d.date).map(d => d.date!));
        for (let i = 1; i < dates.length; i++) {
            // Use UTC midnight to avoid DST-related hour shifts on DST boundaries
            const prev = new Date(dates[i - 1] + 'T00:00:00Z');
            const curr = new Date(dates[i] + 'T00:00:00Z');
            const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
            expect(diffDays).toBe(1);
        }
    });

    it('spans month boundaries correctly (Feb → Mar)', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-10T10:00:00'));
        const groups = buildMonthGroups();
        const months = groups.map(g => g.month);
        expect(months).toContain('February 2026');
        expect(months).toContain('March 2026');
    });

    it('today marker is derived from local date (regression)', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-15T00:30:00Z'));
        const groups = buildMonthGroups();
        const todayDay = groups.flatMap(g => g.days).find(d => d.type === 'active' && d.isToday);
        // Today must always equal toLocaleDateString('en-CA'), regardless of UTC offset
        const localDate = new Date().toLocaleDateString('en-CA');
        expect(todayDay?.date).toBe(localDate);
    });
});
