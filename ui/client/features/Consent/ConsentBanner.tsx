/**
 * W8b — GDPR cookie-consent banner.
 *
 * First-visit banner with categorised opt-in (strictly-necessary / functional
 * / analytics / marketing). Two non-dark-pattern CTAs — "Accept all" and
 * "Manage preferences" (never a lone accept button) — plus an explicit
 * "Reject all". The preference surface (`ConsentPreferences`) expands inline.
 *
 * Built on the canonical `@client/lib/consent` lib: that owns the storage
 * model (localStorage source-of-truth + `cookie_consent` mirror cookie),
 * the DNT/GPC signal readers, and the change bus that analytics + marketing
 * capture subscribe to.
 *
 * The banner does NOT show when:
 *  - a current-version consent record already exists, or
 *  - a DNT / GPC signal is active — in which case a `MIN_CONSENT` record is
 *    pre-written silently so downstream consumers read a definite state.
 *
 * Inline styles are intentional: the consent UI must render correctly before
 * global stylesheets load (no FOUC, no missing controls on a slow paint).
 * Motion respects `prefers-reduced-motion`.
 *
 * Mounted once, globally, from `ui/client/pages/_app.tsx`.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {
    CONSENT_VERSION,
    EU_DEFAULT_CONSENT,
    MIN_CONSENT,
    type ConsentRecord,
    hasDecided,
    persistConsent,
    privacySignalActive,
} from '@client/lib/consent';
import ConsentPreferences from './ConsentPreferences';

const ALL_ON: ConsentRecord = {
    version: CONSENT_VERSION,
    categories: {necessary: true, functional: true, analytics: true, marketing: true},
    source: 'user',
    recordedAt: new Date(0).toISOString(),
};

const ConsentBanner: React.FC = () => {
    const [visible, setVisible] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [draft, setDraft] = useState<ConsentRecord>(EU_DEFAULT_CONSENT);
    const reducedMotion = useMemo(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        // Already decided (current version) — stay dismissed.
        if (hasDecided()) return;
        // DNT / GPC pre-emptive opt-out: persist a MIN record silently so
        // every consumer reads a definite state, and never surface the banner.
        if (privacySignalActive()) {
            persistConsent({...MIN_CONSENT, source: 'signal'});
            return;
        }
        setVisible(true);
    }, []);

    const acceptAll = (): void => {
        persistConsent({...ALL_ON, recordedAt: new Date().toISOString()});
        setVisible(false);
    };

    const rejectAll = (): void => {
        persistConsent({...MIN_CONSENT, source: 'user', recordedAt: new Date().toISOString()});
        setVisible(false);
    };

    const saveChoices = (): void => {
        persistConsent({
            ...draft,
            version: CONSENT_VERSION,
            source: 'user',
            categories: {...draft.categories, necessary: true},
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
            aria-labelledby="consent-banner-title"
            data-testid="consent-banner"
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
            <h2 id="consent-banner-title" style={{margin: 0, fontSize: 18, fontWeight: 600}}>
                Your privacy choices
            </h2>
            <p style={{marginTop: 8, marginBottom: 12, fontSize: 14, lineHeight: 1.5}}>
                We use cookies and similar technologies to run the site, remember preferences,
                measure usage, and (optionally) attribute marketing. Strictly necessary cookies
                are always on. Manage the rest below — your choice is stored on this device and
                applied across it.
            </p>

            {expanded && (
                <ConsentPreferences draft={draft} onChange={setDraft}/>
            )}

            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end'}}>
                {!expanded && (
                    <button
                        type="button"
                        data-testid="consent-banner-manage"
                        onClick={() => setExpanded(true)}
                        style={btnSecondary}
                    >
                        Manage preferences
                    </button>
                )}
                {expanded && (
                    <button
                        type="button"
                        data-testid="consent-banner-save"
                        onClick={saveChoices}
                        style={btnSecondary}
                    >
                        Save choices
                    </button>
                )}
                <button
                    type="button"
                    data-testid="consent-banner-reject"
                    onClick={rejectAll}
                    style={btnSecondary}
                >
                    Reject all
                </button>
                <button
                    type="button"
                    data-testid="consent-banner-accept"
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

export default ConsentBanner;
