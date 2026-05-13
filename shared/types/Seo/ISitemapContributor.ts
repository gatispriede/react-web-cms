/**
 * Sitemap-contributor contract — W8h roadmap (seo-program).
 *
 * Each feature that owns public URLs (Navigation pages, Posts, Products,
 * Inventory listings, etc.) exports a contributor function that emits
 * the URLs it owns. The sitemap aggregator walks the registered
 * contributors and stitches them into one sitemap (or splits into a
 * sitemap index once any feature crosses the 50k Google limit).
 *
 * Keep this file zero-dep so it can be imported from both `services/`
 * and `ui/client/` without circular issues.
 */

export type SitemapChangeFreq =
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';

export interface SitemapAlternate {
    /** Locale code as exposed by `next-i18next.config.js#i18n.locales`. */
    hreflang: string;
    /** Absolute URL of the alternate. */
    href: string;
}

export interface SitemapEntry {
    /** Absolute URL — origin + path, no fragment. */
    loc: string;
    /** ISO-8601 timestamp of the last meaningful change. */
    lastmod?: string;
    changefreq?: SitemapChangeFreq;
    /** 0.0 – 1.0. */
    priority?: number;
    alternates?: SitemapAlternate[];
}

export interface SitemapContributorContext {
    /** Public origin, e.g. `https://funisimo.pro`. No trailing slash. */
    origin: string;
    /** Configured locales from `next-i18next.config.js`. */
    locales: readonly string[];
    /** Default locale from `next-i18next.config.js`. */
    defaultLocale: string;
}

export type SitemapContributor = (
    ctx: SitemapContributorContext,
) => Promise<SitemapEntry[]>;

export interface SitemapContributorRegistration {
    /** Stable key — `pages`, `posts`, `products`, etc. */
    feature: string;
    contributor: SitemapContributor;
}
