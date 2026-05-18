/**
 * Wave 8b — consent record storage + DNT/GPC signal detection.
 *
 * Source of truth: `localStorage[STORAGE_KEY]`. Mirrored to a
 * `cookie_consent` cookie so the server can read it on the next request
 * for SSR-time guarding (e.g. don't inject analytics tag if rejected).
 *
 * Versioned schema — bump `CONSENT_VERSION` whenever the category list
 * changes, which causes the banner to re-prompt (per GDPR re-consent
 * cadence guidance).
 */
export const CONSENT_VERSION = 1;
export const STORAGE_KEY = 'cms.privacy.consent.v1';
export const COOKIE_NAME = 'cookie_consent';
export const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 395; // ~13 months — EU practice

export const CONSENT_CATEGORIES = ['necessary', 'functional', 'analytics', 'marketing'] as const;
export type CookieCategory = typeof CONSENT_CATEGORIES[number];

export interface ConsentRecord {
    version: number;
    categories: Record<CookieCategory, boolean>;
    /** 'user' = clicked-through choice; 'signal' = derived from DNT/GPC. */
    source: 'user' | 'signal';
    recordedAt: string;
}

export const MIN_CONSENT: ConsentRecord = {
    version: CONSENT_VERSION,
    categories: {necessary: true, functional: false, analytics: false, marketing: false},
    source: 'signal',
    recordedAt: new Date(0).toISOString(),
};

export const EU_DEFAULT_CONSENT: ConsentRecord = {
    version: CONSENT_VERSION,
    categories: {necessary: true, functional: true, analytics: false, marketing: false},
    source: 'user',
    recordedAt: new Date(0).toISOString(),
};

export function readConsent(): ConsentRecord | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as ConsentRecord;
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch {
        return null;
    }
}

export function persistConsent(record: ConsentRecord): void {
    if (typeof window === 'undefined') return;
    const stamped: ConsentRecord = {
        ...record,
        recordedAt: record.recordedAt && record.recordedAt !== new Date(0).toISOString()
            ? record.recordedAt
            : new Date().toISOString(),
    };
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
    } catch { /* private mode — ignore */ }
    // Mirror to cookie for server-side reads.
    try {
        const value = encodeURIComponent(JSON.stringify(stamped.categories));
        document.cookie = `${COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
    } catch { /* ignore */ }
}

export function isDoNotTrackOn(): boolean {
    if (typeof navigator === 'undefined') return false;
    const dnt = (navigator as Navigator & {msDoNotTrack?: string}).msDoNotTrack
        ?? navigator.doNotTrack
        ?? (window as Window & {doNotTrack?: string}).doNotTrack;
    return dnt === '1' || dnt === 'yes';
}

export function isGpcOn(): boolean {
    if (typeof navigator === 'undefined') return false;
    return (navigator as Navigator & {globalPrivacyControl?: boolean}).globalPrivacyControl === true;
}

/** True if the user (or signal) has consented to the named category. */
export function hasConsent(category: CookieCategory): boolean {
    const r = readConsent();
    if (!r) return category === 'necessary';
    return Boolean(r.categories[category]);
}
