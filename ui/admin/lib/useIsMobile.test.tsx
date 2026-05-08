// @vitest-environment jsdom
import React from 'react';
import {render, act} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useIsMobile, ADMIN_MOBILE_BREAKPOINT_PX} from './useIsMobile';

/**
 * `useIsMobile` is the load-bearing primitive for every admin mobile
 * conditional render. These tests pin the contract:
 *   1. Default to `false` (desktop) on first render — SSR-safe.
 *   2. Sync against `matchMedia` after mount.
 *   3. Re-evaluate when the matchMedia 'change' event fires.
 *   4. Honor a custom breakpoint argument.
 *   5. Use the documented 768 px constant by default.
 */

interface MqlMock {
    matches: boolean;
    media: string;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    addListener: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    dispatchEvent: () => boolean;
    onchange: null;
}

let currentMql: MqlMock | null = null;

beforeEach(() => {
    currentMql = null;
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn((query: string): MqlMock => {
            const mql: MqlMock = {
                matches: false,
                media: query,
                onchange: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: () => true,
            };
            currentMql = mql;
            return mql;
        }),
    });
});

const Probe = ({breakpoint, onChange}: {breakpoint?: number; onChange: (v: boolean) => void}): null => {
    const v = useIsMobile(breakpoint);
    onChange(v);
    return null;
};

describe('useIsMobile', () => {
    it('exports the documented default breakpoint', () => {
        expect(ADMIN_MOBILE_BREAKPOINT_PX).toBe(768);
    });

    it('starts false on first render (SSR-safe)', () => {
        const seen: boolean[] = [];
        render(<Probe onChange={v => seen.push(v)}/>);
        expect(seen[0]).toBe(false);
    });

    it('flips to true when matchMedia.matches is true at mount', () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            configurable: true,
            value: vi.fn((query: string): MqlMock => {
                const mql: MqlMock = {
                    matches: true,
                    media: query,
                    onchange: null,
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                    addListener: vi.fn(),
                    removeListener: vi.fn(),
                    dispatchEvent: () => true,
                };
                currentMql = mql;
                return mql;
            }),
        });
        const seen: boolean[] = [];
        render(<Probe onChange={v => seen.push(v)}/>);
        // Effect runs, syncs to true.
        expect(seen[seen.length - 1]).toBe(true);
    });

    it('reacts to matchMedia change events', () => {
        const seen: boolean[] = [];
        render(<Probe onChange={v => seen.push(v)}/>);
        expect(currentMql).not.toBeNull();
        const listener = currentMql!.addEventListener.mock.calls[0][1] as (e: {matches: boolean}) => void;
        act(() => {
            listener({matches: true});
        });
        expect(seen[seen.length - 1]).toBe(true);
        act(() => {
            listener({matches: false});
        });
        expect(seen[seen.length - 1]).toBe(false);
    });

    it('honors a custom breakpoint argument', () => {
        render(<Probe breakpoint={500} onChange={() => undefined}/>);
        expect(currentMql).not.toBeNull();
        // matchMedia query string includes the custom breakpoint - 1.
        expect(currentMql!.media).toBe('(max-width: 499px)');
    });

    it('falls back to the legacy addListener API when addEventListener is missing', () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            configurable: true,
            value: vi.fn((query: string): Partial<MqlMock> => {
                const mql = {
                    matches: false,
                    media: query,
                    addListener: vi.fn(),
                    removeListener: vi.fn(),
                };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                currentMql = mql as any;
                return mql;
            }),
        });
        render(<Probe onChange={() => undefined}/>);
        expect(currentMql!.addListener).toHaveBeenCalled();
    });
});
