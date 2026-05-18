import type {NextApiRequest} from 'next';
import {gqlFetch} from '@client/lib/gqlFetch';
import type {NavRow} from '@client/lib/slugChain';
import type {SitemapEntry} from '@interfaces/Seo/ISitemapContributor';
import {
    buildPagesEntries,
    buildPostEntries,
    buildProductEntries,
    type SitemapPost,
    type SitemapProduct,
} from '@services/features/Seo/defaultSitemapContributors';

/**
 * Shared sitemap helpers — W8h SEO program § sitemap index split.
 *
 * The original `/api/sitemap.xml` route emits everything in one urlset.
 * Per the spec, when total entries cross 50k we instead serve a
 * `<sitemapindex>` referencing per-feature sub-sitemaps. This module
 * keeps the data-fetch + per-feature builders in one place so the
 * top-level handler + the per-feature endpoints share one source of
 * truth.
 */

const i18nConfig = require('../../../../../next-i18next.config.js');

export const SITEMAP_URL_CAP = 50000;

export interface SitemapContext {
    origin: string;
    locales: string[];
    defaultLocale: string;
}

export interface SitemapSnapshot {
    pages: NavRow[];
    posts: SitemapPost[];
    products: SitemapProduct[];
    blogEnabled: boolean;
}

export function resolveContext(req: NextApiRequest): SitemapContext {
    const proto = (req.headers['x-forwarded-proto'] as string | undefined) || 'http';
    const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host || 'localhost';
    const origin = `${proto}://${host}`;
    const locales: string[] = i18nConfig?.i18n?.locales ?? ['en'];
    const defaultLocale: string = i18nConfig?.i18n?.defaultLocale ?? 'en';
    return {origin, locales, defaultLocale};
}

export async function loadSnapshot(): Promise<SitemapSnapshot> {
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
    try { posts = data?.mongo?.getPosts ? JSON.parse(data.mongo.getPosts) : []; } catch { /* tolerate */ }
    try {
        const parsed = data?.mongo?.getProducts ? JSON.parse(data.mongo.getProducts) : [];
        products = Array.isArray(parsed) ? parsed : [];
    } catch { /* tolerate */ }
    try {
        if (data?.mongo?.getSiteFlags) blogEnabled = JSON.parse(data.mongo.getSiteFlags).blogEnabled !== false;
    } catch { /* default true */ }
    return {pages, posts, products, blogEnabled};
}

const escapeXml = (s: string): string => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export function entriesToUrlsetXml(entries: SitemapEntry[]): string {
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

export function indexXml(subSitemapUrls: string[]): string {
    const now = new Date().toISOString();
    const items = subSitemapUrls.map((u) => `  <sitemap><loc>${escapeXml(u)}</loc><lastmod>${now}</lastmod></sitemap>`);
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...items,
        '</sitemapindex>',
        '',
    ].join('\n');
}

export type SitemapFeature = 'pages' | 'posts' | 'products';

export function entriesForFeature(
    feature: SitemapFeature,
    snapshot: SitemapSnapshot,
    ctx: SitemapContext,
): SitemapEntry[] {
    if (feature === 'pages') return buildPagesEntries(snapshot.pages, ctx.origin, ctx.locales, ctx.defaultLocale);
    if (feature === 'posts') return buildPostEntries(snapshot.posts, ctx.origin, snapshot.blogEnabled);
    if (feature === 'products') return buildProductEntries(snapshot.products, ctx.origin);
    return [];
}

export function totalEntryCount(snapshot: SitemapSnapshot, ctx: SitemapContext): number {
    return entriesForFeature('pages', snapshot, ctx).length
        + entriesForFeature('posts', snapshot, ctx).length
        + entriesForFeature('products', snapshot, ctx).length;
}

export function featureCounts(snapshot: SitemapSnapshot, ctx: SitemapContext): Record<SitemapFeature, number> {
    return {
        pages: entriesForFeature('pages', snapshot, ctx).length,
        posts: entriesForFeature('posts', snapshot, ctx).length,
        products: entriesForFeature('products', snapshot, ctx).length,
    };
}


// Next.js 16 requires a default export for every file in pages/api/.
import type {NextApiResponse} from 'next';
export default function _noop(_req: NextApiRequest, res: NextApiResponse) { res.status(404).end(); }
