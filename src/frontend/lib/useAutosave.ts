import {useCallback, useEffect, useRef, useState} from 'react';

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface AutosaveResult<T> {
    status: AutosaveStatus;
    error?: string;
    /** Stamp a change — starts the debounce timer, flips state to `dirty`. */
    markDirty: (value: T) => void;
    /** Force an immediate save (e.g. on unmount or Cmd-S). */
    flush: () => Promise<void>;
}

/**
 * Debounced autosave hook. Consumer calls `markDirty(value)` on every change;
 * after `delay` ms of quiet, the hook invokes `saver(value)`. Returns a
 * `status` that a UI badge can render ("saving…" / "saved"). On error the
 * badge flips to `error` with a message; the consumer can retry by marking
 * dirty again.
 */
export function useAutosave<T>(
    saver: (value: T) => Promise<void>,
    delay = 1000,
): AutosaveResult<T> {
    const [status, setStatus] = useState<AutosaveStatus>('idle');
    const [error, setError] = useState<string | undefined>();
    const pendingRef = useRef<T | undefined>(undefined);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saverRef = useRef(saver);
    saverRef.current = saver;

    const doSave = useCallback(async () => {
        const value = pendingRef.current;
        if (value === undefined) return;
        pendingRef.current = undefined;
        setStatus('saving');
        setError(undefined);
        try {
            await saverRef.current(value);
            setStatus('saved');
        } catch (err) {
            setStatus('error');
            setError(String((err as Error)?.message ?? err));
        }
    }, []);

    const markDirty = useCallback((value: T) => {
        pendingRef.current = value;
        setStatus('dirty');
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { void doSave(); }, delay);
    }, [delay, doSave]);

    const flush = useCallback(async () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        await doSave();
    }, [doSave]);

    useEffect(() => () => {
        // Fire any pending save on unmount so last edit isn't lost.
        if (timerRef.current) clearTimeout(timerRef.current);
        void doSave();
    }, [doSave]);

    return {status, error, markDirty, flush};
}
