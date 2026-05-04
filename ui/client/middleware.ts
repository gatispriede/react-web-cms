import {NextRequest, NextResponse} from 'next/server';

/**
 * Next.js middleware — runs at the edge before page rendering.
 *
 * Currently used only by Q5 admin-segregation Phase 3: log every hit on
 * the legacy admin URLs (`/admin/settings`, `/admin/languages`,
 * `/admin/modules-preview`) before the next.config.js redirect fires.
 * Lets us watch traffic for ~1 week to confirm bookmarks are gone before
 * deleting the underlying page files.
 *
 * Once observed traffic falls to zero (check via the errors panel filter
 * `scope: legacy-route`), delete:
 *   - `ui/client/middleware.ts` (this file, if no other middleware uses)
 *   - `ui/client/pages/admin/settings.tsx`
 *   - `ui/client/pages/admin/languages.tsx`
 *   - `ui/client/pages/admin/modules-preview.tsx`
 *   - the matching entries from `next.config.js#redirects`
 *
 * Runbook: docs/runbooks/admin-segregation-phase3.md
 */

const LEGACY_ROUTES = new Set([
    '/admin/settings',
    '/admin/languages',
    '/admin/modules-preview',
]);

export const config = {
    matcher: ['/admin/settings', '/admin/languages', '/admin/modules-preview'],
};

export async function middleware(req: NextRequest): Promise<NextResponse> {
    const pathname = req.nextUrl.pathname;
    if (LEGACY_ROUTES.has(pathname)) {
        // Fire-and-forget log to the existing error intake. We use the
        // error endpoint (level: 'warn', scope: 'legacy-route') rather
        // than build a new one — keeps observability surface unified.
        // Failures are silent: we don't want to block the redirect on a
        // log write outage.
        const origin = req.nextUrl.origin;
        const body = JSON.stringify({
            source: 'admin',
            level: 'warn',
            message: `legacy admin route hit: ${pathname}`,
            scope: 'legacy-route',
            route: pathname,
            extra: {
                referrer: req.headers.get('referer') ?? null,
                userAgent: req.headers.get('user-agent') ?? null,
            },
        });
        // `void` so we don't await; middleware must finish promptly so
        // the redirect can fire.
        void fetch(`${origin}/api/log/error`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body,
            // Fail fast — we don't want middleware to hang on a slow log
            // write blocking the redirect.
            signal: AbortSignal.timeout(500),
        }).catch(() => undefined);
    }
    return NextResponse.next();
}
