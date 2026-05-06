/**
 * Analytics event shape — first-party tracking, not another GA.
 * Per `docs/features/platform/client-analytics.md` (decision 2026-05-02).
 *
 * Strict allowlist on `props` — string/number/boolean only. Server-side
 * ingest validates before write so a buggy / hostile client can't bloat
 * the collection or smuggle PII through abused custom events.
 *
 * v2 (2026-05-06): added `audience` segmentation + richer `ua.*` fields
 * parsed server-side from the UA header. The dashboard defaults to
 * `audience === 'public'` so admin/internal/bot traffic never skews
 * customer numbers; full data is retained for retroactive re-segmentation.
 */
export type AnalyticsAudience = 'public' | 'admin' | 'internal' | 'bot';

export interface IAnalyticsUA {
    /** Coarse device class — primary breakdown axis. */
    device: 'mobile' | 'tablet' | 'desktop' | 'bot';
    /** Browser family (e.g. `Chrome`, `Safari`, `Firefox`, `Edge`). */
    browser?: string;
    /** Browser major version (e.g. `124`). Cardinality bounded — major only. */
    browserVersion?: string;
    /** OS family (e.g. `Windows`, `macOS`, `iOS`, `Android`, `Linux`). */
    os?: string;
    /** OS version (e.g. `14.5`, `11`). Truncated to 16 chars. */
    osVersion?: string;
    /** Hardware vendor (`Apple`, `Samsung`). 64-char cap. */
    vendor?: string;
    /** Hardware model (`iPhone15,2`, `SM-S921B`). 64-char cap. */
    model?: string;
}

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
    /** Server-derived from the UA header (ua-parser-js). Client-supplied UA is ignored. */
    ua?: IAnalyticsUA;
    viewport?: {w: number; h: number};
    locale?: string;
    /**
     * Server-stamped traffic segment. Tagged at ingest from three signals,
     * in priority order:
     *   1. `bot`       — UA matches the `isbot` heuristic.
     *   2. `internal`  — request IP is on the Mongo-backed allowlist
     *                    (admin-editable at `/admin/system/analytics-filters`).
     *   3. `admin`     — authenticated session is an admin user (any
     *                    role above `customer`), OR the request path is
     *                    under `/admin/*`.
     *   4. `public`    — everything else (default).
     *
     * Filtering happens at QUERY time, not at ingest. Old rows without
     * an explicit `audience` are treated as `public`. The backfill in
     * `tools/scripts/analytics-backfill-audience.mjs` retro-tags via a
     * `userId → users.role` join for the rolling 90-day retention window.
     */
    audience?: AnalyticsAudience;
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
    /** Max chars per UA-derived field (browser/os/vendor/model). */
    UA_FIELD_LEN: 64,
} as const;

/**
 * Mongo-backed IP allowlist that tags inbound traffic as `audience: 'internal'`.
 * Admin-editable at `/admin/system/analytics-filters`. Stored in the
 * `AnalyticsFilters` collection — single document per environment, no
 * sharding, < 1KB. CIDR not supported in v2 — exact match on IPv4/IPv6
 * literal; that's enough for office/VPN/static-home setups.
 */
export interface IAnalyticsFilters {
    /** Document id — always the literal string `'default'`. */
    _id?: string;
    /** Exact-match IP literals. Matched case-insensitively against the request IP. */
    internalIps: string[];
    /** Free-text label per IP for the admin UI ("office router", "alex home"). */
    labels?: Record<string, string>;
    /** Last-edited stamp for the audit log row. */
    updatedAt?: number;
    /** Email of the admin who last edited. */
    updatedBy?: string;
}
