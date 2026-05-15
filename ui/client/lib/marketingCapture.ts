/**
 * W6c — client-side marketing attribution capture.
 *
 * On first page-load, parses URL params (`utm_*`, `ref`) + `document.referrer`
 * and persists the tuple server-side via `recordMarketingHit`. The hit is
 * keyed by a long-lived `attr_session_id` cookie (90 days) so subsequent
 * hits and the eventual signup / order can be joined on the same session.
 *
 * Called from `_app.tsx` at first-mount. Best-effort: any failure is
 * swallowed (we never block the page on marketing telemetry).
 *
 * Server-side persistence happens via the public GraphQL mutation
 * `recordMarketingHit` (anonOpen, rate-limited at the service).
 *
 * W8b — consent gating: marketing attribution is the `marketing` cookie
 * category. Capture (and the `attr_session_id` cookie write that backs it)
 * is gated on `hasConsent('marketing')`, which also returns false whenever a
 * DNT / GPC signal is active. If the visitor later grants marketing consent
 * via the banner, `captureMarketingHit()` re-runs off the consent change bus.
 */
import {hasConsent, onConsentChange} from '@client/lib/consent';

const COOKIE_NAME = 'attr_session_id';
const SESSION_KEY = 'attr_session_id';
const HIT_FLAG_KEY = 'attr_hit_sent';
const COOKIE_MAX_AGE_DAYS = 90;

function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const m = document.cookie.split('; ').find(r => r.startsWith(`${name}=`));
    return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string, days: number) {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 86_400_000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Expires=${expires}; SameSite=Lax`;
}

function uuid(): string {
    // Best-effort RFC4122 v4. crypto.randomUUID() is the gold path; the
    // Math.random() fallback is only there for ancient Safari.
    if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
        return (crypto as any).randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export function getOrCreateSessionId(): string {
    let id = readCookie(COOKIE_NAME);
    if (id) return id;
    try {
        id = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY)) || null;
    } catch { /* private mode */ }
    if (!id) id = uuid();
    writeCookie(COOKIE_NAME, id, COOKIE_MAX_AGE_DAYS);
    try { sessionStorage.setItem(SESSION_KEY, id); } catch { /* ignore */ }
    return id;
}

interface CapturedHit {
    sessionId: string;
    utm: {source?: string; medium?: string; campaign?: string; term?: string; content?: string};
    ref?: string;
    landingPath: string;
    referrer?: string;
}

function parseFromLocation(): CapturedHit | null {
    if (typeof window === 'undefined') return null;
    const url = new URL(window.location.href);
    const sessionId = getOrCreateSessionId();
    const hit: CapturedHit = {
        sessionId,
        utm: {
            source: url.searchParams.get('utm_source') ?? undefined,
            medium: url.searchParams.get('utm_medium') ?? undefined,
            campaign: url.searchParams.get('utm_campaign') ?? undefined,
            term: url.searchParams.get('utm_term') ?? undefined,
            content: url.searchParams.get('utm_content') ?? undefined,
        },
        ref: url.searchParams.get('ref') ?? undefined,
        landingPath: url.pathname,
        referrer: document.referrer || undefined,
    };
    return hit;
}

async function postHit(hit: CapturedHit): Promise<void> {
    try {
        await fetch('/api/graphql', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                query: `mutation RecordHit($input: JSON!) { mongo { recordMarketingHit(input: $input) } }`,
                variables: {input: hit},
            }),
        });
    } catch { /* ignore — telemetry is best-effort */ }
}

let consentSubscribed = false;

/**
 * Capture marketing attribution on first hit per page-load. Idempotent
 * via `sessionStorage[HIT_FLAG_KEY]` so SPA route changes inside the
 * same session don't double-post.
 *
 * Consent-gated (W8b): no-op unless `marketing` consent is granted — which
 * also covers DNT / GPC (those force `marketing` off). When called without
 * consent, it subscribes once to the consent change bus so a later "Accept"
 * in the banner re-triggers capture without a page reload.
 */
export function captureMarketingHit(): void {
    if (typeof window === 'undefined') return;
    if (!hasConsent('marketing')) {
        // Re-attempt capture if the visitor grants marketing consent later.
        if (!consentSubscribed) {
            consentSubscribed = true;
            onConsentChange(() => {
                if (hasConsent('marketing')) captureMarketingHit();
            });
        }
        return;
    }
    try {
        if (sessionStorage.getItem(HIT_FLAG_KEY) === '1') return;
    } catch { /* fall through — best-effort */ }
    const hit = parseFromLocation();
    if (!hit) return;
    try { sessionStorage.setItem(HIT_FLAG_KEY, '1'); } catch { /* ignore */ }
    void postHit(hit);
}

/**
 * Attach the current session to a user id. Called from signup-success +
 * magic-link verify success so the captured anonymous hits get linked.
 */
export async function attachMarketingSessionToUser(userId: string): Promise<void> {
    if (typeof window === 'undefined' || !userId) return;
    const sessionId = readCookie(COOKIE_NAME);
    if (!sessionId) return;
    try {
        await fetch('/api/graphql', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                query: `mutation AttachSession($input: JSON!) { mongo { attachMarketingSession(input: $input) } }`,
                variables: {input: {sessionId, userId}},
            }),
        });
    } catch { /* ignore */ }
}
