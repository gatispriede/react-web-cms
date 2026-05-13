/**
 * Wave 8b — Cookie consent banner.
 *
 * Appears on first visit (no prior `cookie_consent` in localStorage/cookie),
 * presents the four predefined categories from `CONSENT_CATEGORIES`, persists
 * the user's choice to both `localStorage` (source of truth, cross-tab) AND a
 * `cookie_consent` cookie (so the server can read consent state on the
 * next request without an extra round trip).
 *
 * Predefined category enum — no free-text. Strictly-necessary is locked on
 * (legally exempt from consent). Banner does NOT show when:
 *  - a prior choice exists (localStorage), or
 *  - DNT (`navigator.doNotTrack === '1'`) is on, or
 *  - GPC (`navigator.globalPrivacyControl === true`) is on
 *
 * In the DNT/GPC case we pre-write a `min` consent record so downstream
 * consumers can read it without having to re-detect signals every page.
 *
 * Motion: respects `prefers-reduced-motion` — skip entry transition. The
 * inline CSS is intentional (banner must not depend on global styles
 * loading before showing — FOUC otherwise).
 */
import React, {useEffect, useMemo, useState} from 'react';
import {
    CONSENT_CATEGORIES,
    CONSENT_VERSION,
    type CookieCategory,
    type ConsentRecord,
    EU_DEFAULT_CONSENT,
    MIN_CONSENT,
    persistConsent,
    readConsent,
    isDoNotTrackOn,
    isGpcOn,
} from './consentStore';

const CATEGORY_LABEL: Record<CookieCategory, string> = {
    necessary: 'Strictly necessary',
    functional: 'Functional',
    analytics: 'Analytics',
    marketing: 'Marketing',
};

const CATEGORY_DESC: Record<CookieCategory, string> = {
    necessary: 'Required for the site to work — session, security, language.',
    functional: 'Remember your preferences (theme, currency, recent searches).',
    analytics: 'Aggregate, anonymised usage stats so we can improve the site.',
    marketing: 'Attribution + advertising effectiveness measurement.',
};

const CookieConsent: React.FC = () => {
    const [visible, setVisible] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [draft, setDraft] = useState<ConsentRecord>(EU_DEFAULT_CONSENT);
    const reducedMotion = useMemo(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const prior = readConsent();
        if (prior && prior.version === CONSENT_VERSION) return;
        // DNT / GPC pre-emptive opt-out. Persist a `min` record so the
        // banner stays dismissed across visits, but don't surface it.
        if (isDoNotTrackOn() || isGpcOn()) {
            persistConsent({...MIN_CONSENT, source: 'signal'});
            return;
        }
        setVisible(true);
    }, []);

    const acceptAll = (): void => {
        persistConsent({
            version: CONSENT_VERSION,
            categories: {necessary: true, functional: true, analytics: true, marketing: true},
            source: 'user',
            recordedAt: new Date().toISOString(),
        });
        setVisible(false);
    };

    const rejectAll = (): void => {
        persistConsent({...MIN_CONSENT, source: 'user'});
        setVisible(false);
    };

    const saveCustom = (): void => {
        persistConsent({
            version: CONSENT_VERSION,
            categories: {...draft.categories, necessary: true}, // necessary always on
            source: 'user',
            recordedAt: new Date().toISOString(),
        });
        setVisible(false);
    };

    if (!visible) return null;

    const transition = reducedMotion ? 'none' : 'transform 200ms ease, opacity 200ms ease';

    return (
        <div
            role="dialog"
            aria-modal="false"
            aria-labelledby="cookie-consent-title"
            data-testid="cookie-consent-banner"
            style={{
                position: 'fixed',
                left: 16,
                right: 16,
                bottom: 16,
                zIndex: 10000,
                maxWidth: 720,
                margin: '0 auto',
                background: 'var(--cms-bg-elev, #fff)',
                color: 'var(--cms-fg, #111)',
                border: '1px solid var(--cms-border, #ddd)',
                borderRadius: 12,
                padding: 20,
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                transition,
            }}
        >
            <h2 id="cookie-consent-title" style={{margin: 0, fontSize: 18, fontWeight: 600}}>
                Your privacy choices
            </h2>
            <p style={{marginTop: 8, marginBottom: 12, fontSize: 14, lineHeight: 1.5}}>
                We use cookies and similar technologies to run the site, remember preferences,
                measure usage, and (optionally) attribute marketing. Strictly necessary cookies
                are always on. You can adjust the rest below — your choice is stored locally
                and applied across this device.
            </p>

            {expanded && (
                <div data-testid="cookie-consent-categories" style={{margin: '12px 0'}}>
                    {CONSENT_CATEGORIES.map(cat => (
                        <label
                            key={cat}
                            style={{display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0'}}
                            data-testid={`cookie-consent-category-${cat}`}
                        >
                            <input
                                type="checkbox"
                                checked={cat === 'necessary' ? true : Boolean(draft.categories[cat])}
                                disabled={cat === 'necessary'}
                                onChange={e => setDraft(d => ({
                                    ...d,
                                    categories: {...d.categories, [cat]: e.target.checked},
                                }))}
                                data-testid={`cookie-consent-toggle-${cat}`}
                                style={{marginTop: 3}}
                            />
                            <span>
                                <strong>{CATEGORY_LABEL[cat]}</strong>
                                <br/>
                                <span style={{fontSize: 13, opacity: 0.75}}>{CATEGORY_DESC[cat]}</span>
                            </span>
                        </label>
                    ))}
                </div>
            )}

            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end'}}>
                {!expanded && (
                    <button
                        type="button"
                        data-testid="cookie-consent-customise"
                        onClick={() => setExpanded(true)}
                        style={btnSecondary}
                    >
                        Customise
                    </button>
                )}
                {expanded && (
                    <button
                        type="button"
                        data-testid="cookie-consent-save"
                        onClick={saveCustom}
                        style={btnSecondary}
                    >
                        Save choices
                    </button>
                )}
                <button
                    type="button"
                    data-testid="cookie-consent-reject"
                    onClick={rejectAll}
                    style={btnSecondary}
                >
                    Reject all
                </button>
                <button
                    type="button"
                    data-testid="cookie-consent-accept"
                    onClick={acceptAll}
                    style={btnPrimary}
                >
                    Accept all
                </button>
            </div>
        </div>
    );
};

const btnPrimary: React.CSSProperties = {
    background: 'var(--cms-accent, #c65a2a)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 500,
};

const btnSecondary: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--cms-fg, #111)',
    border: '1px solid var(--cms-border, #aaa)',
    borderRadius: 8,
    padding: '8px 16px',
    cursor: 'pointer',
};

export default CookieConsent;
