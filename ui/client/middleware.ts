import {NextRequest, NextResponse} from 'next/server';

/**
 * Next.js middleware — runs at the edge before page rendering.
 *
 * Responsibilities:
 *
 *   1. **Customer-login gate** (auth-split-client-admin, Phase 1.A) —
 *      when `siteFlags.auth.clientLoginEnabled === false`, any request
 *      under `/account/*` is rewritten to `/404` so the storefront
 *      surfaces no customer-auth UI at all. The flag is fetched via a
 *      lightweight internal endpoint and cached in-process for 30s
 *      so the cold path is one fetch per minute per edge worker, not
 *      per request.
 *
 *   2. **Redirect map** (W8h SEO program § redirect map) — for any
 *      public path that doesn't start with `/api`, `/admin`,
 *      `/_next`, or static asset prefixes, consult the operator-
 *      editable redirect table via `/api/seo/redirect-lookup`. If a
 *      match exists, return a 301 / 302 immediately.
 *
 *   3. **Legacy admin-segregation logging** — Q5 Phase-3 carry-over.
 *      Log every hit on the deprecated admin URLs before the
 *      next.config.js redirect fires so we can monitor bookmark
 *      traffic.
 *
 * Once observed traffic on the legacy admin routes falls to zero
 * (check via the errors panel filter `scope: legacy-route`), drop
 * step 3 + the matching entries from `next.config.js#redirects`.
 *
 * Runbook: docs/runbooks/auth-stack-split.md (gate) +
 * docs/runbooks/admin-segregation-phase3.md (legacy)
 */

const LEGACY_ROUTES = new Set([
    '/admin/settings',
    '/admin/languages',
    '/admin/modules-preview',
]);

// Paths we never consult the redirect table for. Keeping the skip
// list tight is the cheapest perf win — every public page would
// otherwise pay one round-trip per cold cache.
const REDIRECT_SKIP_PREFIXES = [
    '/api/',
    '/admin/',
    '/_next/',
    '/static/',
    '/images/',
    '/seeds/',
    '/favicon',
];

export const config = {
    // Run middleware for ALL paths (the redirect map is global) but
    // bail out early in code for skip-list paths. Static assets are
    // already excluded by the negative lookahead.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

// ----------------------------------------------------------------------
// In-process flag cache. The edge runtime can have multiple workers,
// each holds its own slot — that's fine; the worst case is one extra
// `/api/site/auth-flags` round-trip per minute per worker.
// ----------------------------------------------------------------------
interface AuthFlagsCache {
    clientLoginEnabled: boolean;
    fetchedAt: number;
}
let authFlagsCache: AuthFlagsCache | null = null;
const AUTH_FLAGS_TTL_MS = 30_000;

async function readClientLoginEnabled(origin: string): Promise<boolean> {
    const now = Date.now();
    if (authFlagsCache && now - authFlagsCache.fetchedAt < AUTH_FLAGS_TTL_MS) {
        return authFlagsCache.clientLoginEnabled;
    }
    try {
        const res = await fetch(`${origin}/api/site/auth-flags`, {
            signal: AbortSignal.timeout(500),
        });
        if (!res.ok) {
            // Fail closed — when the lookup is unavailable we treat
            // the gate as OFF so we don't leak the account surface.
            authFlagsCache = {clientLoginEnabled: false, fetchedAt: now};
            return false;
        }
        const data = (await res.json()) as {clientLoginEnabled?: boolean};
        const enabled = Boolean(data?.clientLoginEnabled);
        authFlagsCache = {clientLoginEnabled: enabled, fetchedAt: now};
        return enabled;
    } catch {
        // Network blip / 404 / parse error → fail closed.
        authFlagsCache = {clientLoginEnabled: false, fetchedAt: now};
        return false;
    }
}

// ----------------------------------------------------------------------
// Commerce checkout gate cache (Phase 1.B). Mirrors the auth pattern
// above; one extra `/api/commerce/flag-status` roundtrip per 30s per
// worker. Failure mode: fail-closed (catalogue-only). See
// `services/features/Commerce/commerceFlags.ts`.
// ----------------------------------------------------------------------
interface CommerceFlagsCache {
    checkoutEnabled: boolean;
    fetchedAt: number;
}
let commerceFlagsCache: CommerceFlagsCache | null = null;
const COMMERCE_FLAGS_TTL_MS = 30_000;

async function readCheckoutEnabled(origin: string): Promise<boolean> {
    const now = Date.now();
    if (commerceFlagsCache && now - commerceFlagsCache.fetchedAt < COMMERCE_FLAGS_TTL_MS) {
        return commerceFlagsCache.checkoutEnabled;
    }
    try {
        const res = await fetch(`${origin}/api/commerce/flag-status`, {
            signal: AbortSignal.timeout(500),
        });
        if (!res.ok) {
            commerceFlagsCache = {checkoutEnabled: false, fetchedAt: now};
            return false;
        }
        const data = (await res.json()) as {checkoutEnabled?: boolean};
        const enabled = Boolean(data?.checkoutEnabled);
        commerceFlagsCache = {checkoutEnabled: enabled, fetchedAt: now};
        return enabled;
    } catch {
        commerceFlagsCache = {checkoutEnabled: false, fetchedAt: now};
        return false;
    }
}

async function lookupRedirect(req: NextRequest, pathname: string): Promise<NextResponse | null> {
    const origin = req.nextUrl.origin;
    try {
        const res = await fetch(`${origin}/api/seo/redirect-lookup?path=${encodeURIComponent(pathname)}`, {
            // Edge runtime fetch supports the `cache` directive; we
            // already cache-control the response server-side.
            signal: AbortSignal.timeout(500),
        });
        if (!res.ok || res.status === 204) return null;
        const data = (await res.json()) as {to?: string; code?: 301 | 302};
        if (!data?.to) return null;
        const code: 301 | 302 = data.code === 302 ? 302 : 301;
        const target = data.to.startsWith('http')
            ? data.to
            : new URL(data.to, origin).toString();
        return NextResponse.redirect(target, code);
    } catch {
        // Never let the redirect lookup block the response. The
        // operator can re-publish their entries; missing one
        // redirect for one request is a smaller harm than blanking
        // the page.
        return null;
    }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
    const pathname = req.nextUrl.pathname;

    // 1. Customer-login gate. Cheap path: only consult the flag when
    //    the request actually targets the gated tree.
    if (pathname.startsWith('/account')) {
        const enabled = await readClientLoginEnabled(req.nextUrl.origin);
        if (!enabled) {
            return NextResponse.rewrite(new URL('/404', req.url));
        }
    }

    // 1b. Checkout gate (Phase 1.B). When
    //     `commerce.checkoutEnabled === false`, `/checkout/*` rewrites
    //     to /404 so catalogue-only sites stop exposing the checkout
    //     surface. Placed alphabetically below the /account gate so
    //     both additive blocks coexist without restructuring.
    if (pathname.startsWith('/checkout')) {
        const enabled = await readCheckoutEnabled(req.nextUrl.origin);
        if (!enabled) {
            return NextResponse.rewrite(new URL('/404', req.url));
        }
    }

    // 2. Redirect map — skip the obvious non-public paths.
    const isSkipped = REDIRECT_SKIP_PREFIXES.some((p) => pathname.startsWith(p));
    if (!isSkipped) {
        const redirect = await lookupRedirect(req, pathname);
        if (redirect) return redirect;
    }

    // 3. Legacy-admin-route logging.
    if (LEGACY_ROUTES.has(pathname)) {
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
        void fetch(`${origin}/api/log/error`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body,
            signal: AbortSignal.timeout(500),
        }).catch(() => undefined);
    }
    return NextResponse.next();
}

/** Test seam — clear the cached flag between specs. Edge runtime
 *  isolates module state per worker, so this is only useful for
 *  Node-runtime integration tests. */
export function _resetAuthFlagsCache(): void {
    authFlagsCache = null;
}

/** Test seam — clear the cached commerce flag between specs. */
export function _resetCommerceFlagsCache(): void {
    commerceFlagsCache = null;
}
