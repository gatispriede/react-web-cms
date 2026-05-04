/**
 * `useGuardedAction` — destructive-mutation guard wrapper.
 *
 * Re-entrant clicks on a "Delete" / "Revoke" / "Remove" button silently
 * collapse to a single in-flight execution; downstream mutations get a
 * fresh `idempotencyKey` (UUIDv4) per `trigger()` so the server-side
 * `IdempotencyService` can collapse retries that bypass the UI guard
 * (network double-fire, mid-flight reload, etc.).
 *
 * Two surfaces:
 *
 *   1. `useGuardedAction(fn)` — React hook. Component-friendly; wraps
 *      its `pending` flag in a state hook so the UI re-renders. Used in
 *      `ui/admin/lib/**` and `ui/admin/shell/**` where `useState` is fine.
 *
 *   2. `GuardedAction` — plain class. VM-friendly; the `pending` flag
 *      is a plain field on the instance, mutated through whatever
 *      reactivity layer the host VM uses (the project's Proxy-based
 *      `observable()` notices it on the next set). Used inside
 *      `ui/admin/features/**` where the VM4 `useState` ban applies.
 *
 * Both share the same trigger semantics: a fresh `idempotencyKey` is
 * created at the start of every accepted call and passed to the wrapped
 * function via the second argument of `fn` IF the wrapped function is
 * a partial-application that already encodes its args. The cleanest
 * call shape (used at every adapted callsite below) is:
 *
 *   const guard = new GuardedAction(({idempotencyKey}) =>
 *       postApi.remove(post.id, {idempotencyKey}));
 *   await guard.trigger();
 *
 * The VM stores the `GuardedAction` per destructive op so the button's
 * `loading` prop can read `guard.pending` and render the spinner; the
 * Proxy reactivity flips it on every mutation.
 */
import {useCallback, useEffect, useRef, useState} from 'react';

/**
 * Cross-environment UUID — `crypto.randomUUID` is universally available
 * in modern browsers and Node 19+. The `@ts-ignore` is for the rare
 * test environment where `crypto` is shimmed.
 */
function newKey(): string {
    // jsdom provides `crypto.randomUUID` since v22; the fallback covers
    // ancient test envs and SSR contexts where `crypto` is namespaced.
    const c: any = (typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined);
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    // RFC4122-ish fallback — random hex, NOT cryptographic strength.
    // Idempotency keys only need uniqueness, not unguessability.
    const hex = (n: number) => Math.floor(Math.random() * (1 << n)).toString(16);
    return `${hex(16)}${hex(16)}-${hex(16)}-${hex(12)}-${hex(12)}-${hex(16)}${hex(16)}${hex(16)}`;
}

export interface GuardArgs {
    /** Fresh per-`trigger` UUIDv4 — pass to mutation calls so the server collapses replays. */
    idempotencyKey: string;
}

export type GuardedFn<A extends any[]> = (guard: GuardArgs, ...args: A) => Promise<unknown>;

/**
 * Plain-class equivalent of the hook. Suitable for any context where
 * `useState` is unavailable / banned (every VM under `ui/admin/features`).
 *
 * The class is intentionally small — `pending` is a plain assignable
 * field so the project's Proxy observability picks up the write and
 * re-renders subscribers. No event emitter, no listener wiring.
 */
export interface GuardedActionOptions {
    /**
     * Called whenever `pending` flips. Use this to push the flag onto an
     * observable host (e.g. the parent VM) so the project's Proxy
     * reactivity layer re-renders subscribers — a nested-object write
     * would otherwise be invisible to the top-level VM proxy.
     */
    onPendingChange?: (pending: boolean) => void;
}

export class GuardedAction<A extends any[] = []> {
    pending = false;
    constructor(
        private readonly fn: GuardedFn<A>,
        private readonly opts: GuardedActionOptions = {},
    ) {}

    private setPending(v: boolean): void {
        this.pending = v;
        try { this.opts.onPendingChange?.(v); }
        catch { /* host listener errors must not strand `pending=true` */ }
    }

    async trigger(...args: A): Promise<void> {
        if (this.pending) return;
        this.setPending(true);
        try {
            await this.fn({idempotencyKey: newKey()}, ...args);
        } finally {
            this.setPending(false);
        }
    }
}

export interface UseGuardedActionResult<A extends any[]> {
    trigger: (...args: A) => Promise<void>;
    pending: boolean;
}

/**
 * React hook. Re-entrant `trigger` calls while `pending === true` are
 * silently dropped. A fresh `idempotencyKey` is generated per accepted
 * call and threaded into `fn`'s first argument.
 */
export function useGuardedAction<A extends any[]>(fn: GuardedFn<A>): UseGuardedActionResult<A> {
    const [pending, setPending] = useState(false);
    // Hold the latest `fn` in a ref so callers can pass inline arrows
    // without invalidating the memoised `trigger` identity.
    const fnRef = useRef(fn);
    useEffect(() => { fnRef.current = fn; }, [fn]);
    // In-flight flag in a ref — `pending` state may not have flushed by
    // the time a sync re-click arrives in the same tick.
    const inFlight = useRef(false);

    const trigger = useCallback(async (...args: A) => {
        if (inFlight.current) return;
        inFlight.current = true;
        setPending(true);
        try {
            await fnRef.current({idempotencyKey: newKey()}, ...args);
        } finally {
            inFlight.current = false;
            setPending(false);
        }
    }, []);

    return {trigger, pending};
}
