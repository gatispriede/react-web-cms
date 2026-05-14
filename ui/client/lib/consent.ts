/**
 * W8b — GDPR cookie-consent + DNT/GPC signal handling (canonical lib).
 *
 * Single source of truth for the consent record, the cookie classification
 * registry, and the Do-Not-Track / Global-Privacy-Control signal readers.
 * The `features/Consent/` banner is the UI on top of this; analytics +
 * marketing capture call `hasConsent()` (or subscribe via `onConsentChange`)
 * to gate themselves.
 *
 * Storage model (per spec §"Cookie consent banner"):
 *   - `localStorage[STORAGE_KEY]`  — user-facing source of truth, cross-tab
 *   - `cookie_consent` cookie       — mirror of `categories`, so the server
 *                                     can read consent on the next request
 *                                     without a round-trip
 *
 * Versioned: bump `CONSENT_VERSION` when the category list / cookie registry
 * changes materially — that re-prompts the banner (GDPR re-consent cadence,
 * ~13 months). `COOKIE_MAX_AGE_SEC` encodes the 13-month expiry directly.
 *
 * NB: `ui/client/components/CookieConsent/consentStore.ts` is the earlier
 * partial; it shares the same `STORAGE_KEY` + `cookie_consent` cookie name
 * so records written by either are mutually readable. New code should import
 * from here.
 */

export const CONSENT_VERSION = 1;
export const STORAGE_KEY = 'cms.privacy.consent.v1';
export const COOKIE_NAME = 'cookie_consent';
/** ~13 months — the GDPR consent re-prompt cadence. */
export const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 395;

export const CONSENT_CATEGORIES = ['necessary', 'functional', 'analytics', 'marketing'] as const;
export type CookieCategory = typeof CONSENT_CATEGORIES[number];

export interface ConsentRecord {
    version: number;
    categories: Record<CookieCategory, boolean>;
    /** 'user' = clicked-through choice; 'signal' = derived from DNT/GPC. */
    source: 'user' | 'signal';
    recordedAt: string;
}

/** DNT/GPC default — everything optional off, necessary on. */
export const MIN_CONSENT: ConsentRecord = {
    version: CONSENT_VERSION,
    categories: {necessary: true, functional: false, analytics: false, marketing: false},
    source: 'signal',
    recordedAt: new Date(0).toISOString(),
};

/** EU pre-choice default surfaced in the banner — analytics + marketing off. */
export const EU_DEFAULT_CONSENT: ConsentRecord = {
    version: CONSENT_VERSION,
    categories: {necessary: true, functional: true, analytics: false, marketing: false},
    source: 'user',
    recordedAt: new Date(0).toISOString(),
};

/** Non-EU default — analytics on, marketing still off (safer baseline). */
export const US_DEFAULT_CONSENT: ConsentRecord = {
    version: CONSENT_VERSION,
    categories: {necessary: true, functional: true, analytics: true, marketing: false},
    source: 'user',
    recordedAt: new Date(0).toISOString(),
};

// ---------------------------------------------------------------------------
// Signal detection — Do Not Track + Global Privacy Control
// ---------------------------------------------------------------------------

/** True if the browser is sending a Do-Not-Track signal. */
export function isDoNotTrackOn(): boolean {
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as Navigator & {msDoNotTrack?: string};
    const win = typeof window !== 'undefined'
        ? (window as Window & {doNotTrack?: string})
        : undefined;
    const dnt = nav.msDoNotTrack ?? navigator.doNotTrack ?? win?.doNotTrack;
    return dnt === '1' || dnt === 'yes';
}

/**
 * True if the browser is sending a Global Privacy Control signal.
 * GPC has legal force in California + some EU jurisdictions; the request
 * also carries a `Sec-GPC: 1` header server-side.
 */
export function isGpcOn(): boolean {
    if (typeof navigator === 'undefined') return false;
    return (navigator as Navigator & {globalPrivacyControl?: boolean}).globalPrivacyControl === true;
}

/** True if either privacy signal is on — analytics + marketing must stay off. */
export function privacySignalActive(): boolean {
    return isDoNotTrackOn() || isGpcOn();
}

/**
 * The consent state to apply before the user has clicked anything.
 * DNT/GPC always wins; otherwise jurisdiction picks the default.
 */
export function defaultConsentForJurisdiction(
    jurisdiction: 'EU' | 'US' | 'OTHER',
): ConsentRecord {
    if (privacySignalActive()) return {...MIN_CONSENT, source: 'signal'};
    if (jurisdiction === 'EU') return {...EU_DEFAULT_CONSENT};
    return {...US_DEFAULT_CONSENT};
}

// ---------------------------------------------------------------------------
// Read / persist
// ---------------------------------------------------------------------------

export function readConsent(): ConsentRecord | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as ConsentRecord;
        if (!parsed || typeof parsed !== 'object' || !parsed.categories) return null;
        return parsed;
    } catch {
        return null;
    }
}

/** True once the user (or a privacy signal) has produced a current-version record. */
export function hasDecided(): boolean {
    const r = readConsent();
    return Boolean(r && r.version === CONSENT_VERSION);
}

export function persistConsent(record: ConsentRecord): void {
    if (typeof window === 'undefined') return;
    const epoch = new Date(0).toISOString();
    const stamped: ConsentRecord = {
        ...record,
        version: CONSENT_VERSION,
        categories: {...record.categories, necessary: true}, // necessary is non-negotiable
        recordedAt: record.recordedAt && record.recordedAt !== epoch
            ? record.recordedAt
            : new Date().toISOString(),
    };
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
    } catch { /* private mode — ignore */ }
    // Mirror the category map to a cookie for server-side reads.
    try {
        const value = encodeURIComponent(JSON.stringify(stamped.categories));
        document.cookie = `${COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
    } catch { /* ignore */ }
    notifyConsentChange(stamped);
}

/**
 * True if the named category is currently consented. Conservative: with no
 * record at all, only `necessary` is allowed. Honours live DNT/GPC even if a
 * stale permissive record somehow exists (signal cannot be over-ridden up).
 */
export function hasConsent(category: CookieCategory): boolean {
    if (category === 'necessary') return true;
    if (privacySignalActive() && (category === 'analytics' || category === 'marketing')) {
        return false;
    }
    const r = readConsent();
    if (!r) return false;
    return Boolean(r.categories[category]);
}

// ---------------------------------------------------------------------------
// Change bus — lets analytics / marketing capture re-evaluate without polling
// ---------------------------------------------------------------------------

type ConsentListener = (record: ConsentRecord) => void;
const listeners = new Set<ConsentListener>();

/** Subscribe to consent changes. Returns an unsubscribe fn. */
export function onConsentChange(fn: ConsentListener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function notifyConsentChange(record: ConsentRecord): void {
    listeners.forEach(fn => {
        try { fn(record); } catch { /* a listener must never break persist */ }
    });
    if (typeof window !== 'undefined') {
        try {
            window.dispatchEvent(new CustomEvent('cms:consent-change', {detail: record}));
        } catch { /* ignore */ }
    }
}

// ---------------------------------------------------------------------------
// Cookie classification registry (spec §"Cookie classification")
// ---------------------------------------------------------------------------

export interface ICookieEntry {
    name: string;
    setBy: string;
    category: CookieCategory;
    description: string;
    /** 'session' | '1y' | '13m' | '90d' | … */
    expiry: string;
    httpOnly: boolean;
}

/**
 * Every cookie the storefront sets. Surfaced read-only here so the banner /
 * preference modal can describe each category honestly. Keep in sync when a
 * new cookie is introduced anywhere in `ui/client`.
 */
export const COOKIE_REGISTRY: ICookieEntry[] = [
    {name: 'next-auth.session-token', setBy: 'platform', category: 'necessary', description: 'Authenticated session token.', expiry: '30d', httpOnly: true},
    {name: 'cms.customer-session', setBy: 'platform', category: 'necessary', description: 'Customer (storefront) authenticated session.', expiry: '30d', httpOnly: true},
    {name: COOKIE_NAME, setBy: 'platform', category: 'necessary', description: 'Stores your cookie-consent preferences.', expiry: '13m', httpOnly: false},
    {name: 'i18next', setBy: 'platform', category: 'functional', description: 'Remembers your selected language.', expiry: '1y', httpOnly: false},
    {name: 'a_id', setBy: 'platform', category: 'analytics', description: 'Anonymous first-party analytics id.', expiry: '1y', httpOnly: false},
    {name: 'attr_session_id', setBy: 'platform', category: 'marketing', description: 'Marketing-attribution session id (UTM / referrer).', expiry: '90d', httpOnly: false},
];

// ---------------------------------------------------------------------------
// Data-retention note (spec §"Data-retention TTLs")
// ---------------------------------------------------------------------------

export interface IRetentionRule {
    subject: string;
    ttl: string;
    note: string;
}

/**
 * Client-visible data-retention summary — what the storefront promises about
 * how long each class of data lives. The authoritative enforcement (Mongo TTL
 * indexes) is operator/server-side; this is the copy the `/privacy` surfaces
 * render. Flagged-for-operator: wire the actual TTL indexes server-side.
 */
export const DATA_RETENTION_RULES: IRetentionRule[] = [
    {subject: 'Marketing-attribution sessions', ttl: '90 days', note: 'Anonymous attribution evaporates if no signup follows.'},
    {subject: 'Magic-link tokens', ttl: '15 minutes', note: 'Single-use auth tokens.'},
    {subject: 'Email log', ttl: '180 days', note: 'Recipient hash only — never message body.'},
    {subject: 'Order records', ttl: '7 years', note: 'Tax-law retention; customer-identifying fields anonymised after a delete request settles.'},
    {subject: 'Deleted-account cool-off', ttl: '7 days', note: 'Window to undo an account deletion before the cascade runs.'},
];
