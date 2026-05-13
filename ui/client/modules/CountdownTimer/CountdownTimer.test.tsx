// @vitest-environment jsdom
import React from 'react';
import {render, screen, act} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi, afterEach} from 'vitest';
import CountdownTimer from './CountdownTimer';

afterEach(() => {
    vi.useRealTimers();
});

const TARGET = '2030-01-10T00:00:00.000Z';

describe('CountdownTimer', () => {
    it('renders days/hours/minutes/seconds with nowOverride', () => {
        const now = new Date('2030-01-08T22:58:57.000Z');
        render(<CountdownTimer testId="cd" target={TARGET} nowOverride={now} />);
        expect(screen.getByTestId('cd-days').textContent).toBe('01');
        expect(screen.getByTestId('cd-hours').textContent).toBe('01');
        expect(screen.getByTestId('cd-minutes').textContent).toBe('01');
        expect(screen.getByTestId('cd-seconds').textContent).toBe('03');
    });

    it('renders ended state when now > target', () => {
        const now = new Date('2031-01-01T00:00:00.000Z');
        render(<CountdownTimer testId="cd" target={TARGET} nowOverride={now} endedLabel="Done" />);
        expect(screen.getByTestId('cd-ended')).toHaveTextContent('Done');
        expect(screen.queryByTestId('cd-days')).toBeNull();
    });

    it('forceReducedMotion shows static "Starts in N days" string and hides units', () => {
        const now = new Date('2030-01-05T00:00:00.000Z');
        render(<CountdownTimer testId="cd" target={TARGET} nowOverride={now} forceReducedMotion />);
        expect(screen.getByTestId('cd-reduced').textContent).toBe('Starts in 5 days');
        expect(screen.queryByTestId('cd-days')).toBeNull();
        expect(screen.queryByTestId('cd-seconds')).toBeNull();
    });

    it('computes units across multi-day spans', () => {
        const now = new Date('2030-01-01T00:00:00.000Z');
        render(<CountdownTimer testId="cd" target={TARGET} nowOverride={now} />);
        expect(screen.getByTestId('cd-days').textContent).toBe('09');
        expect(screen.getByTestId('cd-hours').textContent).toBe('00');
    });

    it('cleans interval on unmount', () => {
        vi.useFakeTimers();
        const clearSpy = vi.spyOn(global, 'clearInterval');
        const {unmount} = render(<CountdownTimer testId="cd" target={TARGET} />);
        act(() => { vi.advanceTimersByTime(1500); });
        unmount();
        expect(clearSpy).toHaveBeenCalled();
        clearSpy.mockRestore();
    });
});
