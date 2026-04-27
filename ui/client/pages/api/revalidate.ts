import type {NextApiRequest, NextApiResponse} from 'next';
import {gqlFetch} from '@client/lib/gqlFetch';
import {pageNameToPath, isHomePage} from '@utils/pagePath';
import {ROLE_RANK, sessionFromReq} from '@services/features/Auth/authz';
import {authOptions} from './auth/authOptions';

/**
 * On-demand ISR endpoint. Admin mutations (theme save, section save, nav
 * rename, blog post publish, …) call this after the server ack so the
 * public static pages regenerate immediately instead of waiting for the
 * background ISR window (`revalidate: 3600`).
 *
 * Auth model: NextAuth session cookie. Only `editor`-or-higher roles
 * can trigger regeneration. Public / unauthenticated callers get 401 —
 * we don't want arbitrary visitors churning SSR + Mongo by flooding
 * paths. An optional `REVALIDATE_TOKEN` env var is still honoured for
 * machine-to-machine callers (e.g. a future CMS import script) but is
 * not required.
 *
 * Payload shapes accepted:
 *   { scope: 'all' }                     → revalidate every public path
 *   { scope: 'page', pageName: string }  → /<slug> (or `/` for Home)
 *   { scope: 'post', slug: string }      → /blog + /blog/<slug>
 *   { scope: 'blog' }                    → /blog
 *   { paths: string[] }                  → explicit list (escape hatch)
 */

type RevalidateBody =
    | {scope: 'all'}
    | {scope: 'page'; pageName: string}
    | {scope: 'post'; slug: string}
    | {scope: 'blog'}
    | {paths: string[]};

/**
 * Resolve the navigation entry that the public site renders at `/`.
 *
 * The home slot is positional — `pages/app.tsx`'s `findIdForActiveTab`
 * falls back to `tabProps[0]` when the URL is `/`, so whichever nav row
 * is first IS the home page regardless of its display name.
 *
 * The legacy `isHomePage(name)` helper in `@utils/pagePath` only matched
 * the literal English string `"home"`. On a localised install (e.g.
 * skyclimber.pro where the first page is "Sākums") that meant section
 * saves on the home page revalidated `/sākums` — a non-existent path —
 * while the real `/` kept its 1-hour-cached HTML and operators saw
 * "publish does nothing". Resolving by position fixes every locale.
 */
async function fetchHomePageName(): Promise<string | null> {
    const navResp = await gqlFetch<{mongo: {getNavigationCollection: Array<{page: string}>}}>(
        `{ mongo { getNavigationCollection { page } } }`,
    );
    const list = navResp?.mongo?.getNavigationCollection ?? [];
    return list[0]?.page ?? null;
}

function namesMatch(a: string, b: string | null): boolean {
    if (!b) return false;
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function collectAllPaths(): Promise<string[]> {
    const out = new Set<string>(['/', '/blog']);
    const navResp = await gqlFetch<{mongo: {getNavigationCollection: Array<{page: string}>}}>(
        `{ mongo { getNavigationCollection { page } } }`,
    );
    const list = navResp?.mongo?.getNavigationCollection ?? [];
    const homeName = list[0]?.page ?? null;
    for (const p of list) {
        if (!p?.page) continue;
        if (namesMatch(p.page, homeName) || isHomePage(p.page)) {
            // The home page is reachable at TWO prerendered routes: `/`
            // (served by `pages/index.tsx`) AND `/home` / `/<homeSlug>`
            // (served by `pages/[...slug].tsx` because `getStaticPaths`
            // builds a path for every navigation entry, including the
            // first one). Each route is its own ISR cache key, so
            // touching only `/` left the slug variant stuck on the
            // previous snapshot — operators saw the new section order
            // at funisimo.pro/ but the old order at funisimo.pro/home.
            // Always invalidate both.
            out.add('/');
            out.add(pageNameToPath(p.page));
        } else out.add(pageNameToPath(p.page));
    }
    // Published posts — drafts don't appear on `/blog/<slug>`, so asking
    // ISR to revalidate a draft path just 404s and wastes a cycle.
    const postResp = await gqlFetch<{mongo: {getPosts: string}}>(
        `{ mongo { getPosts(limit: 500) } }`,
    );
    try {
        const posts = JSON.parse(postResp?.mongo?.getPosts ?? '[]');
        for (const p of posts) {
            if (p?.slug && p?.published !== false) out.add(`/blog/${p.slug}`);
        }
    } catch { /* ignore parse failure — revalidate what we have */ }
    return [...out];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({error: 'POST only'});
    }
    // Auth path 1 — machine-to-machine shared secret (optional, opt-in).
    const envToken = process.env.REVALIDATE_TOKEN;
    const suppliedToken =
        (req.headers['x-revalidate-token'] as string | undefined) ??
        (req.body && typeof req.body === 'object' ? (req.body as {token?: string}).token : undefined);
    const tokenMatch = !!envToken && !!suppliedToken && suppliedToken === envToken;

    // Auth path 2 — NextAuth session cookie for admin-browser calls.
    let sessionOk = false;
    try {
        const session = await sessionFromReq(req, res, authOptions);
        sessionOk = !!session && ROLE_RANK[session.role] >= ROLE_RANK.editor;
    } catch {
        sessionOk = false;
    }

    if (!tokenMatch && !sessionOk) {
        return res.status(401).json({error: 'unauthorised'});
    }

    const body = req.body as RevalidateBody;
    let paths: string[] = [];
    try {
        if ('paths' in body && Array.isArray(body.paths)) {
            paths = body.paths.filter((p) => typeof p === 'string' && p.startsWith('/'));
        } else if ('scope' in body) {
            switch (body.scope) {
                case 'all':
                    paths = await collectAllPaths();
                    break;
                case 'page': {
                    if (!body.pageName) return res.status(400).json({error: 'pageName required'});
                    // Home is positional (first nav entry), not English-name-matched.
                    // See `fetchHomePageName` rationale.
                    const homeName = await fetchHomePageName();
                    const isHome = namesMatch(body.pageName, homeName) || isHomePage(body.pageName);
                    // For the home page, flush BOTH the index route (`/`)
                    // AND the slug duplicate (`/home`, `/sākums`, …) — see
                    // `collectAllPaths` for why both exist.
                    paths = isHome
                        ? ['/', pageNameToPath(body.pageName)]
                        : [pageNameToPath(body.pageName)];
                    break;
                }
                case 'post':
                    if (!body.slug) return res.status(400).json({error: 'slug required'});
                    paths = ['/blog', `/blog/${body.slug}`];
                    break;
                case 'blog':
                    paths = ['/blog'];
                    break;
                default:
                    return res.status(400).json({error: 'unknown scope'});
            }
        } else {
            return res.status(400).json({error: 'scope or paths required'});
        }
    } catch (err) {
        console.error('[revalidate] path resolution failed:', err);
        return res.status(500).json({error: 'resolve failed'});
    }

    // Deduplicate and cap to a sensible ceiling — ISR regeneration is
    // serial within Next, so `scope: 'all'` on a site with 400 blog
    // posts would hammer the origin. If operators need a bigger window
    // they can bump REVALIDATE_MAX.
    const max = Number(process.env.REVALIDATE_MAX ?? 200);
    const unique = [...new Set(paths)].slice(0, max);

    const results = await Promise.all(unique.map(async (p) => {
        try {
            await res.revalidate(p);
            return {path: p, ok: true};
        } catch (err: any) {
            return {path: p, ok: false, error: err?.message ?? String(err)};
        }
    }));

    return res.status(200).json({count: unique.length, results});
}
