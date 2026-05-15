'use client';

/**
 * Client runtime host — App Router migration, Batch 1.
 *
 * Direct port of the `pages/_app.tsx` `componentDidMount()` block. In
 * the Pages Router the App class component owned this lifecycle; the
 * App Router has no equivalent, so the browser-only side effects move
 * into a tiny `'use client'` component mounted once inside
 * `app/providers.tsx`.
 *
 * Renders nothing — it exists purely for the mount-time effects.
 */
import {useEffect} from 'react';
import {installErrorReporter} from '@client/lib/reportError';
import {startPerfBeacon} from '@client/lib/perfBeacon';
import {captureMarketingHit} from '@client/lib/marketingCapture';

export default function ClientRuntimeHost(): null {
    useEffect(() => {
        // Unregister any stale Service Workers — they cache 404 HTML
        // responses for image URLs and serve them back after the images
        // are uploaded.
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((regs) => {
                regs.forEach((r) => r.unregister());
            });
        }
        // Surface uncaught errors + rejections to the server. Public-site
        // pages report as `source: 'client'`; the admin shell installs
        // again with `'admin'` after it mounts, which overrides the
        // source for the rest of the tab's lifetime.
        installErrorReporter({source: 'client'});
        // Core Web Vitals RUM beacon — W8d. Self-samples at 10 %; no-op
        // on privacy opt-out (GPC/DNT). Lazy-imports `web-vitals` so the
        // lib never lands in the critical bundle.
        startPerfBeacon();
        // W6c — marketing attribution capture (UTM + ref + referrer).
        // Best-effort, fire-and-forget; never blocks the page. Honours a
        // `sessionStorage` idempotency flag so SPA navigations inside the
        // same tab don't double-post.
        captureMarketingHit();
    }, []);

    return null;
}
