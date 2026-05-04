import type {NextApiRequest, NextApiResponse} from 'next';
import {gqlFetch} from '@client/lib/gqlFetch';
import {slugChainForPage, NavRow} from '@client/lib/slugChain';

/**
 * F1 sub-pages — public sitemap.
 *
 * Walks the navigation tree and emits one `<url>` per page. Nested
 * pages get the full slug chain (`/lv/services/cleaning`). The earlier
 * static `public/images/sitemap.xml` was a placeholder — `next.config`
 * already rewrites `/sitemap.xml` to this API route.
 *
 * Locale handling: emits one URL per `locales` entry from
 * `next-i18next.config.js`, with the default locale at the bare path.
 */

// Imported lazily to keep the API bundle from ballooning.
const i18nConfig = require('../../../../next-i18next.config.js');

const escapeXml = (s: string): string => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export interface BuildSitemapInput {
    pages: NavRow[];
    locales: string[];
    defaultLocale: string;
    origin: string;
}

/** Pure builder — exported for unit tests. */
export function buildSitemapXml({pages, locales, defaultLocale, origin}: BuildSitemapInput): string {
    const urls: string[] = [];
    for (const p of pages) {
        // Pre-compute one chain per locale — per-locale slugs (F1
        // follow-up) mean `services/cleaning` (en) becomes
        // `pakalpojumi/tirisana` (lv). Skip pages with a dangling
        // parent for any locale; the cycle case is the same regardless
        // of locale.
        const perLocale = locales.map(loc => ({
            loc,
            chain: slugChainForPage(p, pages, loc, defaultLocale),
        }));
        if (perLocale.some(x => x.chain.length === 0)) continue;
        const hrefFor = (loc: string, chain: string[]): string => {
            const prefix = loc === defaultLocale ? '' : `/${loc}`;
            return `${origin}${prefix}/${chain.join('/')}`;
        };
        for (const {loc, chain} of perLocale) {
            const href = hrefFor(loc, chain);
            const alternates = perLocale.map(({loc: altLoc, chain: altChain}) =>
                `    <xhtml:link rel="alternate" hreflang="${escapeXml(altLoc)}" href="${escapeXml(hrefFor(altLoc, altChain))}"/>`,
            );
            urls.push([
                `  <url>`,
                `    <loc>${escapeXml(href)}</loc>`,
                ...alternates,
                `  </url>`,
            ].join('\n'));
        }
    }
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        ...urls,
        '</urlset>',
        '',
    ].join('\n');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
        const data = await gqlFetch<{mongo: {getNavigationCollection: NavRow[]}}>(
            `{ mongo { getNavigationCollection { id page parent slug } } }`,
        );
        const pages = data?.mongo?.getNavigationCollection ?? [];
        const locales: string[] = i18nConfig?.i18n?.locales ?? ['en'];
        const defaultLocale: string = i18nConfig?.i18n?.defaultLocale ?? 'en';
        const proto = (req.headers['x-forwarded-proto'] as string | undefined) || 'http';
        const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host || 'localhost';
        const origin = `${proto}://${host}`;
        const xml = buildSitemapXml({pages, locales, defaultLocale, origin});
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
        res.status(200).send(xml);
    } catch (err) {
        res.status(500).json({error: String((err as Error).message || err)});
    }
}
