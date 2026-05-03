/**
 * Analytics event shape — first-party tracking, not another GA.
 * Per `docs/features/platform/client-analytics.md` (decision 2026-05-02).
 *
 * Strict allowlist on `props` — string/number/boolean only. Server-side
 * ingest validates before write so a buggy / hostile client can't bloat
 * the collection or smuggle PII through abused custom events.
 */
export interface IAnalyticsEvent {
    /** UUID generated client-side. Lets the server dedupe a retry storm. */
    id: string;
    /** Client epoch ms. */
    ts: number;
    /** Stamped at ingest. */
    serverTs?: number;
    /** First-party UUID kept in a Lax cookie. */
    anonId: string;
    /** Server-stamped from the calling session — never trusted from the client. */
    userId?: string;
    /** Resets after 30 min of `document.hidden`. NOT a server session token. */
    sessionId: string;
    /** `window.location.pathname`. */
    path: string;
    referrer?: string;
    type: 'pageview' | 'interaction' | 'custom';
    /** Event name, e.g. `cart.add`, `checkout.step`. */
    name: string;
    /** Small key/value bag — string|number|boolean only, max 16 keys. */
    props?: Record<string, string | number | boolean>;
    ua?: {device: 'mobile' | 'tablet' | 'desktop'; browser?: string};
    viewport?: {w: number; h: number};
    locale?: string;
    /**
     * Server-derived 2-letter country code (ISO 3166-1 alpha-2).
     *
     * Privacy: this is the ONLY geo-identifying field on a row. The
     * client IP is read once at ingest, passed to `geoLookup()`, and
     * discarded — it is never persisted, logged, or returned. The IP
     * field that lived here in earlier drafts was removed for GDPR
     * minimisation: a 2-letter country is sufficient for the canned
     * dashboard and avoids the data-controller burden of storing IPs.
     *
     * `undefined` when the IP is missing, IPv6 (DB1 is IPv4-only), or
     * not in the bundled dataset — surfaced in the dashboard as
     * "Unknown".
     */
    country?: string;
}

/** Hard caps enforced at ingest — reject the row instead of silently truncating. */
export const ANALYTICS_LIMITS = {
    /** Max events accepted per `trackEvent` mutation call. */
    BATCH_SIZE: 50,
    /** Max distinct keys on `props`. */
    PROPS_KEYS: 16,
    /** Max chars per `props` value. */
    PROP_VALUE_LEN: 256,
    /** Max chars on `name`. */
    NAME_LEN: 64,
    /** Max chars on `path`. */
    PATH_LEN: 512,
    /** Per-anonId rate limit — events per window. */
    RATE_LIMIT_EVENTS: 60,
    /** Rate-limit window milliseconds. */
    RATE_LIMIT_WINDOW_MS: 60_000,
} as const;
