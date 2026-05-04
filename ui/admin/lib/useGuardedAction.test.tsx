// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, vi} from 'vitest';
import {act, render, screen, fireEvent, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {GuardedAction, useGuardedAction} from './useGuardedAction';

/** Test harness — drives `useGuardedAction` through a real DOM button. */
const Harness: React.FC<{fn: (...a: any[]) => Promise<unknown>}> = ({fn}) => {
    const {trigger, pending} = useGuardedAction(fn as any);
    return (
        <button
            data-testid="btn"
            disabled={pending}
            onClick={() => { void trigger(); }}
        >
            {pending ? 'pending' : 'idle'}
        </button>
    );
};

function deferred<T = void>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>(r => { resolve = r; });
    return {promise, resolve};
}

describe('useGuardedAction', () => {
    it('collapses re-entrant clicks while pending', async () => {
        const d = deferred();
        const fn = vi.fn(async (_g: any) => { await d.promise; });
        render(<Harness fn={fn}/>);
        const btn = screen.getByTestId('btn');

        fireEvent.click(btn);
        fireEvent.click(btn);
        fireEvent.click(btn);

        // Only the first click started work.
        expect(fn).toHaveBeenCalledTimes(1);
        // `pending` reflected in the DOM.
        await waitFor(() => expect(btn).toHaveTextContent('pending'));

        await act(async () => { d.resolve(); });
        await waitFor(() => expect(btn).toHaveTextContent('idle'));
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('exposes pending=true while in-flight, false after resolution', async () => {
        const d = deferred();
        const fn = vi.fn(async (_g: any) => { await d.promise; });
        render(<Harness fn={fn}/>);
        const btn = screen.getByTestId('btn');

        expect(btn).toHaveTextContent('idle');
        fireEvent.click(btn);
        await waitFor(() => expect(btn).toHaveTextContent('pending'));
        expect(btn).toBeDisabled();

        await act(async () => { d.resolve(); });
        await waitFor(() => expect(btn).toHaveTextContent('idle'));
        expect(btn).not.toBeDisabled();
    });

    it('passes a fresh idempotencyKey per accepted trigger', async () => {
        const keys: string[] = [];
        const fn = vi.fn(async ({idempotencyKey}: {idempotencyKey: string}) => {
            keys.push(idempotencyKey);
        });
        render(<Harness fn={fn}/>);
        const btn = screen.getByTestId('btn');

        await act(async () => { fireEvent.click(btn); });
        await waitFor(() => expect(btn).toHaveTextContent('idle'));
        await act(async () => { fireEvent.click(btn); });
        await waitFor(() => expect(btn).toHaveTextContent('idle'));

        expect(keys).toHaveLength(2);
        expect(keys[0]).toBeTruthy();
        expect(keys[1]).toBeTruthy();
        expect(keys[0]).not.toBe(keys[1]);
    });
});

describe('GuardedAction (VM-safe class)', () => {
    it('collapses re-entrant trigger() calls while pending', async () => {
        const d = deferred();
        const fn = vi.fn(async (_g: any) => { await d.promise; });
        const action = new GuardedAction(fn);

        const p1 = action.trigger();
        const p2 = action.trigger();
        const p3 = action.trigger();
        expect(action.pending).toBe(true);
        expect(fn).toHaveBeenCalledTimes(1);

        d.resolve();
        await Promise.all([p1, p2, p3]);
        expect(action.pending).toBe(false);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('clears pending after resolution and accepts the next call', async () => {
        const fn = vi.fn(async (_g: any) => {});
        const action = new GuardedAction(fn);
        await action.trigger();
        expect(action.pending).toBe(false);
        await action.trigger();
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('clears pending even if the wrapped fn throws', async () => {
        const fn = vi.fn(async (_g: any) => { throw new Error('boom'); });
        const action = new GuardedAction(fn);
        await expect(action.trigger()).rejects.toThrow('boom');
        expect(action.pending).toBe(false);
    });
});
