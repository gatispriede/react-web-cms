/**
 * Default sitemap contributors — W8h SEO program.
 *
 * Registers the three out-of-the-box contributors:
 *   - `pages`     — Navigation tree, per-locale hreflang alternates
 *   - `posts`     — Published blog posts under `/blog/<slug>`
 *   - `products`  — Public product pages under `/products/<slug>`
 *
 * Data is fetched via the existing `/api/graphql` surface so the API
 * route can call this from a Next.js context without pulling the whole
 * mongoDBConnection into the browser bundle. Tests can register
 * synthetic contributors via `registerSitemapContributor` from
 * `sitemapContributors.ts`.
 */
import {slugChainForPage, type NavRow} from '@client/lib/slugChain';
import type {SitemapAlternate, SitemapEntry} from '@interfaces/Seo/ISitemapContributor';
import {registerSitemapContributor} from './sitemapContributors';

export interface SitemapPost {
    slug: string;
    draft?: boolean;
    publishedAt?: string | null;
    editedAt?: string | null;
}

export interface SitemapProduct {
    slug?: string;
    name?: string;
    publishedAt?: string | null;
    editedAt?: string | null;
}

export interface SitemapSourceData {
    pages: NavRow[];
    posts: SitemapPost[];
    products: SitemapProduct[];
    blogEnabled: boolean;
}

function hrefFor(origin: string, loc: string, defaultLocale: string, chain: string[]): string {
    const prefix = loc === defaultLocale ? '' : `/${loc}`;
    return `${origin}${prefix}/${chain.join('/')}`;
}

export function buildPagesEntries(
    pages: NavRow[],
    origin: string,
    locales: readonly string[],
    defaultLocale: string,
): SitemapEntry[] {
    const out: SitemapEntry[] = [];
    for (const p of pages) {
        const perLocale = locales.map((loc) => ({
            loc,
            chain: slugChainForPage(p, pages, loc, defaultLocale),
        }));
        if (perLocale.some((x) => x.chain.length === 0)) continue;
        for (const {loc, chain} of perLocale) {
            const href = hrefFor(origin, loc, defaultLocale, chain);
            const alternates: SitemapAlternate[] = perLocale.map(({loc: altLoc, chain: altChain}) => ({
                hreflang: altLoc,
                href: hrefFor(origin, altLoc, defaultLocale, altChain),
            }));
            out.push({
                loc: href,
                changefreq: 'daily',
                priority: 0.7,
                alternates,
            });
        }
    }
    return out;
}

export function buildPostEntries(
    posts: SitemapPost[],
    origin: string,
    blogEnabled: boolean,
): SitemapEntry[] {
    if (!blogEnabled || posts.length === 0) return [];
    const out: SitemapEntry[] = [
        {loc: `${origin}/blog`, changefreq: 'daily', priority: 0.7},
    ];
    for (const p of posts) {
        if (!p.slug || p.draft) continue;
        const lastmod = p.editedAt || p.publishedAt || undefined;
        out.push({
            loc: `${origin}/blog/${p.slug}`,
            lastmod: lastmod ?? undefined,
            changefreq: 'weekly',
            priority: 0.6,
        });
    }
    return out;
}

export function buildProductEntries(
    products: SitemapProduct[],
    origin: string,
): SitemapEntry[] {
    const out: SitemapEntry[] = [];
    for (const p of products) {
        const slug = (p.slug ?? p.name ?? '').trim();
        if (!slug) continue;
        const lastmod = p.editedAt || p.publishedAt || undefined;
        out.push({
            loc: `${origin}/products/${slug}`,
            lastmod: lastmod ?? undefined,
            changefreq: 'weekly',
            priority: 0.6,
        });
    }
    return out;
}

/**
 * Wire the three default contributors to a shared data loader. The
 * loader is supplied by the call site (the sitemap API route) so the
 * registration stays decoupled from any specific transport.
 *
 * Idempotent — safe to call multiple times.
 */
export function registerDefaultSitemapContributors(
    loadSourceData: () => Promise<SitemapSourceData>,
): void {
    // We memoise inside one call sequence so the 3 contributors don't
    // each fire the same gql query. The memo is per-`loadSourceData`
    // closure, so each request gets a fresh snapshot.
    let cache: Promise<SitemapSourceData> | null = null;
    const load = (): Promise<SitemapSourceData> => {
        if (!cache) cache = loadSourceData();
        return cache;
    };
    // Reset memo on each registration so a re-registration (test seam)
    // doesn't strand stale data.
    cache = null;

    registerSitemapContributor({
        feature: 'pages',
        contributor: async (ctx) => {
            const data = await load();
            return buildPagesEntries(data.pages, ctx.origin, ctx.locales, ctx.defaultLocale);
        },
    });
    registerSitemapContributor({
        feature: 'posts',
        contributor: async (ctx) => {
            const data = await load();
            return buildPostEntries(data.posts, ctx.origin, data.blogEnabled);
        },
    });
    registerSitemapContributor({
        feature: 'products',
        contributor: async (ctx) => {
            const data = await load();
            return buildProductEntries(data.products, ctx.origin);
        },
    });
}
