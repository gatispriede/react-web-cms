export type ConsentCategory = 'essential' | 'analytics' | 'marketing' | 'personalisation';

export interface ConsentDecision {
    /** Per-category opt-in state. 'essential' is always true. */
    categories: Record<ConsentCategory, boolean>;
    /** ISO timestamp the visitor confirmed (or null when default-deny applied). */
    decidedAt: string | null;
    /** Banner version the decision was made against — bump to re-prompt after policy changes. */
    policyVersion: string;
}

export interface CookieConsentBannerProps {
    /** Bump to force re-prompt after policy / category list changes. */
    policyVersion: string;
    /** Pre-existing decision from server-side cookie. Undefined => no decision yet. */
    initialDecision?: ConsentDecision;
    /** Persists the decision (cookie / GraphQL mutation — operator-supplied). */
    onDecide: (decision: ConsentDecision) => void;
    /** href to the privacy policy. */
    privacyHref: string;
    /** href to the cookie policy. */
    cookieHref?: string;
    /** Banner copy overrides; operator-edited per locale. */
    headline?: string;
    body?: string;
    acceptAllLabel?: string;
    rejectAllLabel?: string;
    customiseLabel?: string;
}
