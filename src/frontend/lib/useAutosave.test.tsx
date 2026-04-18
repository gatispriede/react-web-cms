// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, vi} from 'vitest';
import {render, act, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {useAutosave} from './useAutosave';

// Harness component — exposes hook state + forwards markDirty/flush calls.
const Harness: React.FC<{
    saver: (value: string) => Promise<void>;
    onStatus: (s: string) => void;
    setBus?: (bus: {markDirty: (v: string) => void; flush: () => Promise<void>}) => void;
}> = ({saver, onStatus, setBus}) => {
    const {status, markDirty, flush, error} = useAutosave(saver, 50);
    React.useEffect(() => { onStatus(status); }, [status, onStatus]);
    React.useEffect(() => { setBus?.({markDirty, flush}); }, [markDirty, flush, setBus]);
    return <span>{status}{error ? `:${error}` : ''}</span>;
};

describe('useAutosave', () => {
    it('debounces: two quick markDirty calls → saver sees only the last value', async () => {
        const saver = vi.fn().mockResolvedValue(undefined);
        const statuses: string[] = [];
        let bus: any;
        render(
            <Harness
                saver={saver}
                onStatus={s => statuses.push(s)}
                setBus={b => { bus = b; }}
            />,
        );
        act(() => { bus.markDirty('first'); });
        act(() => { bus.markDirty('second'); });
        await waitFor(() => expect(saver).toHaveBeenCalledTimes(1));
        expect(saver).toHaveBeenCalledWith('second');
        // Status goes dirty then saved; the `saving` step may collapse in
        // React's batched renders when the saver resolves synchronously.
        expect(statuses).toContain('dirty');
        expect(statuses).toContain('saved');
    });

    it('surfaces saver errors as status=error + message', async () => {
        const saver = vi.fn().mockRejectedValue(new Error('boom'));
        let bus: any;
        const {container} = render(
            <Harness saver={saver} onStatus={() => {}} setBus={b => { bus = b; }}/>,
        );
        act(() => { bus.markDirty('x'); });
        await waitFor(() => expect(container.textContent).toMatch(/^error/));
        expect(container.textContent).toContain('boom');
    });

    it('flush() runs pending save immediately, bypassing the debounce', async () => {
        const saver = vi.fn().mockResolvedValue(undefined);
        let bus: any;
        render(
            <Harness saver={saver} onStatus={() => {}} setBus={b => { bus = b; }}/>,
        );
        act(() => { bus.markDirty('immediate'); });
        await act(async () => { await bus.flush(); });
        expect(saver).toHaveBeenCalledWith('immediate');
    });
});
