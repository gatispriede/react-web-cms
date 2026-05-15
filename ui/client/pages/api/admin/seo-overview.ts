import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {sessionFromReq} from '@services/features/Auth/authz';
import {adminAuthOptions as authOptions} from '../auth/authOptions';
import {runSeoPreflight} from '@services/features/Mcp/tools/seo';

/**
 * W8h SEO polish — admin SEO overview endpoint.
 *
 * Aggregates the data the `/admin/system/seo` pane needs in one round-
 * trip:
 *   - `preflight`: site-wide pre-flight warnings (via the same
 *     `runSeoPreflight` the MCP tool + publish flow use).
 *   - `redirectCount`: row count of the operator-editable redirect
 *     table.
 *   - `sitemapCounts`: per-feature sitemap entry counts (pages / posts
 *     / products) plus a coarse OG-coverage stat (pages with `seo.image`
 *     set vs total). No "live URL probe" — the operator can run that
 *     manually via `seo.preflight` per page.
 *
 * Auth: admin-only (read). 401 on anonymous; 403 on customer sessions.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method !== 'GET') {
        res.status(405).json({error: 'GET only'});
        return;
    }
    try {
        const session = await sessionFromReq(req, res, authOptions);
        if (!session || session.kind === 'anonymous') {
            res.status(401).json({error: 'unauthorized'});
            return;
        }
        if (session.kind !== 'admin') {
            res.status(403).json({error: 'admin only'});
            return;
        }
    } catch {
        res.status(401).json({error: 'unauthorized'});
        return;
    }

    try {
        const conn = getMongoConnection();
        const preflight = await runSeoPreflight();
        const redirects = conn.redirectsService ? await conn.redirectsService.list() : [];
        const navs = await conn.navigationService.getNavigationCollection();
        const pageList = Array.isArray(navs) ? navs : [];
        const ogCovered = pageList.filter((n: any) => Boolean(n?.seo?.image)).length;
        const sitemapCounts = {
            pages: pageList.length,
            // posts + products counts are best-effort — read raw JSON
            // strings off the service surface so we don't pay the
            // sitemap-builder cost on every dashboard hit.
            posts: 0,
            products: 0,
        };
        try {
            const postsRaw = await (conn as any).getPosts?.({limit: 500});
            const posts = postsRaw ? JSON.parse(postsRaw) : [];
            sitemapCounts.posts = Array.isArray(posts) ? posts.filter((p: any) => !p?.draft).length : 0;
        } catch { /* tolerate */ }
        try {
            const productsRaw = await (conn as any).getProducts?.();
            const products = productsRaw ? JSON.parse(productsRaw) : [];
            sitemapCounts.products = Array.isArray(products) ? products.length : 0;
        } catch { /* tolerate */ }

        res.status(200).json({
            preflight,
            redirectCount: redirects.length,
            sitemapCounts,
            ogCoverage: {
                covered: ogCovered,
                total: pageList.length,
                pct: pageList.length === 0 ? 0 : Math.round((ogCovered / pageList.length) * 100),
            },
            generatedAt: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({error: String((err as Error).message || err)});
    }
}
