import type {IAnalyticsEvent} from '@interfaces/IAnalytics';

/**
 * Client-side analytics — `track()` API + automatic pageview hook.
 * Per `docs/features/platform/client-analytics.md` (decisions 2026-05-02).
 *
 *   - Honours `Sec-GPC` and `navigator.doNotTrack`. When set, `track()`
 *     captures locally but never flushes (a privacy default, not a knob).
 *   - First-party `anonId` cookie (`a_id`, Lax, 365d). Created on first
 *     event if missing. Cleared on browser data clear; never re-created.
 *   - `sessionId` in sessionStorage; resets after 30 min of
 *     `document.hidden`. NOT a server session token.
 *   - Buffered + flushed every ~5s OR 25 events, whichever first.
 *   - Failure mode is silent — tracking is never allowed to break the
 *     UI.
 */

const COOKIE_NAME = 'a_id';
const SESSION_KEY = 'a_sid';
const SESSION_TS_KEY = 'a_sid_ts';
const SESSION_TTL_MS = 30 * 60 * 1000;
const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_MAX_BATCH = 25;

const queue: IAnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function uuid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    // Fallback — not cryptographically strong, but `id` only needs uniqueness.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

function readCookie(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : undefined;
}

function writeCookie(name: string, value: string, days: number): void {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; Expires=${expires}; Path=/; SameSite=Lax`;
}

function getAnonId(): string {
    const existing = readCookie(COOKIE_NAME);
    if (existing) return existing;
    const fresh = uuid();
    writeCookie(COOKIE_NAME, fresh, 365);
    return fresh;
}

function getSessionId(): string {
    if (typeof sessionStorage === 'undefined') return uuid();
    const existing = sessionStorage.getItem(SESSION_KEY);
    const lastTs = Number(sessionStorage.getItem(SESSION_TS_KEY) ?? 0);
    if (existing && Date.now() - lastTs < SESSION_TTL_MS) {
        sessionStorage.setItem(SESSION_TS_KEY, String(Date.now()));
        return existing;
    }
    const fresh = uuid();
    sessionStorage.setItem(SESSION_KEY, fresh);
    sessionStorage.setItem(SESSION_TS_KEY, String(Date.now()));
    return fresh;
}

function privacyOptOut(): boolean {
    if (typeof navigator === 'undefined') return false;
    // GPC and DNT — honour both.
    const gpc = (navigator as unknown as {globalPrivacyControl?: boolean}).globalPrivacyControl === true;
    const dnt = navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes';
    return gpc || dnt;
}

function buildEvent(
    type: IAnalyticsEvent['type'],
    name: string,
    props?: Record<string, string | number | boolean>,
): IAnalyticsEvent {
    // UA parsing moved to the server (ua-parser-js, ingest-time) in v2.
    // The client no longer sends `ua` — clients are untrusted on this
    // axis (a hostile or buggy client could spoof `mobile` to skew the
    // device-mix dashboard) and the server already has the raw UA
    // header for free.
    return {
        id: uuid(),
        ts: Date.now(),
        anonId: getAnonId(),
        sessionId: getSessionId(),
        path: typeof window !== 'undefined' ? window.location.pathname : '/',
        referrer: typeof document !== 'undefined' && document.referrer ? document.referrer : undefined,
        type,
        name,
        props,
        viewport: typeof window !== 'undefined' ? {w: window.innerWidth, h: window.innerHeight} : undefined,
        locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
    };
}

async function flush(): Promise<void> {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    if (queue.length === 0) return;
    const batch = queue.splice(0, queue.length);
    try {
        await fetch('/api/graphql', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                query: `mutation Track($events: [JSON!]!) { mongo { trackEvent(events: $events) } }`,
                variables: {events: batch},
            }),
            keepalive: true,
        });
    } catch {
        // Silent failure — re-queueing risks a loop on persistent network
        // failure; better to drop this batch.
    }
}

function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = setTimeout(() => { void flush(); }, FLUSH_INTERVAL_MS);
}

/**
 * Record a custom event. Safe to call from any client code; no-op on
 * the server side.
 */
export function track(name: string, props?: Record<string, string | number | boolean>): void {
    if (typeof window === 'undefined') return;
    if (privacyOptOut()) return;
    const ev = buildEvent('custom', name, props);
    queue.push(ev);
    if (queue.length >= FLUSH_MAX_BATCH) {
        void flush();
    } else {
        scheduleFlush();
    }
}

/**
 * Record a pageview. The auto-pageview hook calls this on every route
 * change; manual calls (e.g. for SPA-internal "page" transitions) are
 * also fine.
 */
export function trackPageview(path?: string): void {
    if (typeof window === 'undefined') return;
    if (privacyOptOut()) return;
    const ev = buildEvent('pageview', 'pageview');
    if (path) ev.path = path;
    queue.push(ev);
    scheduleFlush();
}

/** Flush on page unload — `keepalive` allows the request to outlive the unload. */
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => { void flush(); });
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') void flush();
    });
}
