/**
 * Browser-side error reporter.
 *
 * Three intake hooks share one POST → /api/log/error pipe:
 *   1. Global `error` listener — uncaught script exceptions
 *   2. Global `unhandledrejection` — Promise paths that nothing caught
 *   3. Per-API-client `catch` blocks — domain failures with rich context
 *
 * Why one module, not three: the wire format is identical, the
 * dedup/rate-limit logic should fire once across all three sources, and
 * any future change (sampling strategy, sink swap) lands in a single
 * place. Imported once from `_app.tsx` (public site) and once from
 * the admin shell (`UserStatusBar.tsx`) — the difference is just the
 * `source` field on the payload.
 */

import type {ErrorLevel, ErrorSource} from '@interfaces/IErrorLog';

interface ReportInput {
    message: string;
    stack?: string;
    /** Dot-namespaced verb-or-noun pin: `theme.save`, `module.add`, … */
    scope?: string;
    level?: ErrorLevel;
    extra?: Record<string, unknown>;
}

interface ReporterOpts {
    source: ErrorSource;
}

// Module-level dedup window — the same `(scope, message)` pair within
// 5 s is collapsed into one POST. Stops a render-loop bug from posting
// 60 errors a second.
const seen = new Map<string, number>();
const DEDUP_MS = 5_000;

function dedupKey(input: ReportInput): string {
    return `${input.scope ?? '-'}::${(input.message ?? '').slice(0, 200)}`;
}

let installed: ReporterOpts | null = null;

/**
 * Send a single error to the server log. Fire-and-forget — the
 * Promise is not awaited by callers, but exposed for tests.
 */
export function reportError(input: ReportInput): Promise<void> | void {
    if (typeof window === 'undefined') return; // server-side: noop, server has its own logger
    if (!installed) {
        // Admin / client haven't called installErrorReporter yet. Buffer
        // these into the `error` console fall-back so we don't lose them.
         
        console.error('[reportError pre-install]', input);
        return;
    }

    const key = dedupKey(input);
    const now = Date.now();
    const last = seen.get(key);
    if (last !== undefined && now - last < DEDUP_MS) return;
    seen.set(key, now);
    // Soft-bound the dedup map so a long-lived tab doesn't grow unboundedly.
    if (seen.size > 200) {
        const cutoff = now - DEDUP_MS;
        for (const [k, t] of seen) if (t < cutoff) seen.delete(k);
    }

    const payload = {
        source: installed.source,
        level: input.level ?? 'error',
        message: input.message,
        stack: input.stack,
        scope: input.scope,
        route: window.location.pathname,
        userAgent: navigator.userAgent,
        buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? undefined,
        extra: input.extra,
    };

    const body = JSON.stringify(payload);

    // `sendBeacon` survives page unload (e.g. an error fired while the
    // operator clicked a link). Falls back to fetch when the API or
    // payload size disqualifies it.
    try {
        if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
            const blob = new Blob([body], {type: 'application/json'});
            if (navigator.sendBeacon('/api/log/error', blob)) return;
        }
    } catch {/* fall through to fetch */}

    return fetch('/api/log/error', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'same-origin',
        body,
        keepalive: true,
    }).then(() => undefined).catch(() => undefined);
}

/**
 * Wire the global `error` + `unhandledrejection` listeners. Idempotent —
 * calling twice (e.g. once in `_app.tsx` for the public side, once when
 * the admin mounts inside the same tab) is safe because the second call
 * just resets the source to whichever installer ran most recently.
 */
export function installErrorReporter(opts: ReporterOpts): () => void {
    installed = opts;

    if (typeof window === 'undefined') return () => undefined;

    const onError = (event: ErrorEvent) => {
        // `event.error` is the real Error; `event.message` is its message
        // pre-string-coerced. Use both so we never lose the stack.
        const err = event.error as Error | undefined;
        reportError({
            message: err?.message ?? event.message ?? 'unknown error',
            stack: err?.stack,
            scope: 'window.onerror',
            extra: {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
            },
        });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
        const reason: any = event.reason;
        reportError({
            message: reason?.message ?? String(reason),
            stack: reason?.stack,
            scope: 'window.unhandledrejection',
        });
    };

    // Avoid double-binding when this module is hot-reloaded in dev.
    const w = window as any;
    if (w.__errorReporterBound) return () => undefined;
    w.__errorReporterBound = true;

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRejection);
        w.__errorReporterBound = false;
    };
}
