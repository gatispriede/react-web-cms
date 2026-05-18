import type {NextApiRequest, NextApiResponse} from 'next';
import {
    entriesForFeature,
    entriesToUrlsetXml,
    loadSnapshot,
    resolveContext,
    type SitemapFeature,
} from './_shared';

/**
 * W8h SEO program § per-feature sub-sitemap.
 *
 * Endpoints:
 *   /api/sitemap/pages.xml
 *   /api/sitemap/posts.xml
 *   /api/sitemap/products.xml
 *
 * The top-level `/api/sitemap.xml` returns a `<sitemapindex>` linking
 * to these when total URL count crosses `SITEMAP_URL_CAP` (50k — the
 * Google Sitemap Protocol limit). Under the cap, `sitemap.xml` still
 * emits a single urlset for simplicity. Either way, these per-feature
 * routes work in both modes so external tools (Search Console) can
 * fetch them directly.
 */

const FEATURES: SitemapFeature[] = ['pages', 'posts', 'products'];

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
        const raw = req.query.feature;
        const featureKey = String(Array.isArray(raw) ? raw[0] : raw ?? '').replace(/\.xml$/, '');
        if (!FEATURES.includes(featureKey as SitemapFeature)) {
            res.status(404).json({error: `unknown sitemap feature "${featureKey}"`});
            return;
        }
        const ctx = resolveContext(req);
        const snapshot = await loadSnapshot();
        const entries = entriesForFeature(featureKey as SitemapFeature, snapshot, ctx);
        const xml = entriesToUrlsetXml(entries);
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
        res.status(200).send(xml);
    } catch (err) {
        res.status(500).json({error: String((err as Error).message || err)});
    }
}
