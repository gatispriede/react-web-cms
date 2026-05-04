import React from 'react';
import Link from 'next/link';
import type {TFunction} from 'i18next';
import Logo from '@client/features/Logo/Logo';

interface IErrorScreenProps {
    /** Status code shown as the hero numeral (e.g. 404, 500). */
    code: number | string;
    /** Heading copy — short, theme-display-font sized. */
    title: string;
    /** One-sentence body explaining the situation. */
    description: string;
    /** Primary CTA label. Defaults to "Go home". */
    ctaLabel?: string;
    /** Where the CTA points. Defaults to `/`. */
    ctaHref?: string;
    /** Pass-through for the Logo component (it needs t for the edit-dialog
     *  fallback even when admin=false; the error pages always render it
     *  in non-admin mode). */
    t: TFunction<'translation', undefined>;
}

/**
 * Shared themed error screen. Used by 404, 500, and the generic
 * `_error.tsx` catch-all so every error route picks up the active
 * theme's CSS vars (--background, --ink, --accent, --font-display,
 * --font-sans, --theme-borderRadius) without each page re-implementing
 * the layout. The Logo component sits where the favicon mark would be
 * in the browser tab — same brand anchor across every error state.
 */
const ErrorScreen: React.FC<IErrorScreenProps> = ({
    code,
    title,
    description,
    ctaLabel,
    ctaHref = '/',
    t,
}) => {
    return (
        <main
            data-testid="error-screen"
            data-error-code={String(code)}
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 24px',
                gap: 32,
                background: 'var(--background, #fff)',
                color: 'var(--ink, #111)',
                fontFamily: 'var(--font-sans, system-ui, sans-serif)',
                textAlign: 'center',
            }}
        >
            {/* Brand mark — Logo component renders the configured site logo,
                or the default "◆" wordmark when none is set. Mirrors the
                favicon role so the tab icon and the error page lead with
                the same brand anchor. */}
            <div style={{transform: 'scale(1.5)', transformOrigin: 'center'}}>
                <Logo admin={false} t={t}/>
            </div>

            <div
                aria-hidden
                style={{
                    fontFamily: 'var(--font-display, var(--font-sans, system-ui, sans-serif))',
                    fontSize: 'clamp(72px, 18vw, 160px)',
                    lineHeight: 1,
                    fontWeight: 700,
                    letterSpacing: '-0.04em',
                    color: 'var(--accent, var(--primary, currentColor))',
                }}
            >
                {code}
            </div>

            <div style={{maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12}}>
                <h1
                    style={{
                        fontFamily: 'var(--font-display, var(--font-sans, system-ui, sans-serif))',
                        fontSize: 'clamp(24px, 4vw, 36px)',
                        lineHeight: 1.2,
                        margin: 0,
                        fontWeight: 600,
                        color: 'var(--ink, #111)',
                    }}
                >
                    {title}
                </h1>
                <p
                    style={{
                        fontSize: 16,
                        lineHeight: 1.55,
                        margin: 0,
                        color: 'var(--ink-2, var(--ink, #444))',
                        opacity: 0.85,
                    }}
                >
                    {description}
                </p>
            </div>

            <Link
                href={ctaHref}
                data-testid="error-screen-cta"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 44,
                    padding: '10px 24px',
                    borderRadius: 'var(--theme-borderRadius, 6px)',
                    background: 'var(--accent, var(--primary, #111))',
                    color: 'var(--accent-ink, var(--background, #fff))',
                    fontFamily: 'var(--font-sans, system-ui, sans-serif)',
                    fontSize: 15,
                    fontWeight: 500,
                    textDecoration: 'none',
                    border: '1px solid var(--accent, var(--primary, #111))',
                    transition: 'opacity 120ms',
                }}
            >
                {ctaLabel ?? t('Go home')}
            </Link>
        </main>
    );
};

export default ErrorScreen;
