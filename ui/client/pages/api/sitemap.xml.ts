import type {NextApiRequest, NextApiResponse} from 'next';
import {gqlFetch} from '@client/lib/gqlFetch';
import type {NavRow} from '@client/lib/slugChain';
import type {SitemapEntry} from '@interfaces/Seo/ISitemapContributor';
import {
    collectSitemapEntries,
    registerSitemapContributor,
    _resetSitemapContributors,
} from '@services/features/Seo/sitemapContributors';
import {
    buildPagesEntries,
    buildPostEntries,
    buildProductEntries,
    type SitemapPost,
    type SitemapProduct,
} from '@services/features/Seo/defaultSitemapContributors';
import {
    SITEMAP_URL_CAP,
    featureCounts,
    indexXml,
    loadSnapshot,
    resolveContext,
} from './sitemap/_shared';

/**
 * F1 sub-pages — public sitemap. W8h SEO program — refactored onto the
 * `SitemapContributor` pattern so per-feature URL sets can opt in
 * without further changes to this handler. The three default
 * contributors (`pages` / `posts` / `products`) are registered on each
 * request so we don't depend on boot order; future features add their
 * own `registerSitemapContributor()` call at module load.
 *
 * Locale handling: emits one URL per `locales` entry from
 * `next-i18next.config.js`, with the default locale at the bare path.
 *
 * `buildSitemapXml` is kept exported for the historical unit tests
 * (they call into the pure builder, not the request handler).
 */

const i18nConfig = require('../../../../next-i18next.config.js');

const escapeXml = (s: string): string => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export type {SitemapPost};

export interface BuildSitemapInput {
    pages: NavRow[];
    locales: string[];
    defaultLocale: string;
    origin: string;
    posts?: SitemapPost[];
    products?: SitemapProduct[];
    blogEnabled?: boolean;
}

function entriesToXml(entries: SitemapEntry[]): string {
    const urls = entries.map((e) => {
        const lines = [`  <url>`, `    <loc>${escapeXml(e.loc)}</loc>`];
        if (e.lastmod) lines.push(`    <lastmod>${escapeXml(e.lastmod)}</lastmod>`);
        if (e.alternates && e.alternates.length > 0) {
            for (const a of e.alternates) {
                lines.push(`    <xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.href)}"/>`);
            }
        }
        lines.push(`  </url>`);
        return lines.join('\n');
    });
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        ...urls,
        '</urlset>',
        '',
    ].join('\n');
}

/**
 * Pure builder — exported for unit tests + the in-process call paths.
 * Composes the three default contributors directly (no global registry
 * involved) so a test can pass synthetic data without touching state.
 */
export function buildSitemapXml({
    pages,
    locales,
    defaultLocale,
    origin,
    posts = [],
    products = [],
    blogEnabled = true,
}: BuildSitemapInput): string {
    const entries: SitemapEntry[] = [
        ...buildPagesEntries(pages, origin, locales, defaultLocale),
        ...buildPostEntries(posts, origin, blogEnabled),
        ...buildProductEntries(products, origin),
    ];
    return entriesToXml(entries);
}

/**
 * Sitemap index split — W8h SEO polish. When total entry count crosses
 * `SITEMAP_URL_CAP` (Google's 50k-per-file limit) we emit a
 * `<sitemapindex>` referencing the per-feature sub-sitemaps under
 * `/api/sitemap/{pages,posts,products}.xml`. Under the cap we keep the
 * single `<urlset>` for simplicity.
 */
async function tryEmitIndex(req: NextApiRequest, res: NextApiResponse): Promise<boolean> {
    try {
        const ctx = resolveContext(req);
        const snapshot = await loadSnapshot();
        const counts = featureCounts(snapshot, ctx);
        const total = counts.pages + counts.posts + counts.products;
        if (total < SITEMAP_URL_CAP) return false;
        const subs: string[] = [];
        if (counts.pages > 0) subs.push(`${ctx.origin}/api/sitemap/pages.xml`);
        if (counts.posts > 0) subs.push(`${ctx.origin}/api/sitemap/posts.xml`);
        if (counts.products > 0) subs.push(`${ctx.origin}/api/sitemap/products.xml`);
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
        res.status(200).send(indexXml(subs));
        return true;
    } catch {
        return false;
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
        if (await tryEmitIndex(req, res)) return;
        const data = await gqlFetch<{mongo: {
            getNavigationCollection: NavRow[];
            getPosts: string;
            getProducts: string;
            getSiteFlags: string;
        }}>(
            `{ mongo { getNavigationCollection { id page parent slug } getPosts(limit: 500) getProducts getSiteFlags } }`,
        );
        const pages = data?.mongo?.getNavigationCollection ?? [];
        let posts: SitemapPost[] = [];
        let products: SitemapProduct[] = [];
        let blogEnabled = true;
        try {
            posts = data?.mongo?.getPosts ? JSON.parse(data.mongo.getPosts) : [];
        } catch { /* tolerate parse errors — sitemap shouldn't 500 because of blog */ }
        try {
            const parsed = data?.mongo?.getProducts ? JSON.parse(data.mongo.getProducts) : [];
            products = Array.isArray(parsed) ? parsed : [];
        } catch { /* tolerate */ }
        try {
            if (data?.mongo?.getSiteFlags) {
                blogEnabled = JSON.parse(data.mongo.getSiteFlags).blogEnabled !== false;
            }
        } catch { /* default true */ }
        const locales: string[] = i18nConfig?.i18n?.locales ?? ['en'];
        const defaultLocale: string = i18nConfig?.i18n?.defaultLocale ?? 'en';
        const proto = (req.headers['x-forwarded-proto'] as string | undefined) || 'http';
        const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host || 'localhost';
        const origin = `${proto}://${host}`;

        // Re-register the default contributors with this request's data
        // snapshot — keeps boot order out of the picture and lets tests
        // override by registering a custom contributor before calling.
        _resetSitemapContributors();
        registerSitemapContributor({
            feature: 'pages',
            contributor: async (ctx) =>
                buildPagesEntries(pages, ctx.origin, ctx.locales, ctx.defaultLocale),
        });
        registerSitemapContributor({
            feature: 'posts',
            contributor: async (ctx) => buildPostEntries(posts, ctx.origin, blogEnabled),
        });
        registerSitemapContributor({
            feature: 'products',
            contributor: async (ctx) => buildProductEntries(products, ctx.origin),
        });

        const entries = await collectSitemapEntries(
            {origin, locales, defaultLocale},
            (feature, err) => {

                console.error(`[sitemap] contributor "${feature}" failed`, err);
            },
        );
        const xml = entriesToXml(entries);
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
        res.status(200).send(xml);
    } catch (err) {
        res.status(500).json({error: String((err as Error).message || err)});
    }
}
