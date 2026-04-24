/**
 * Convert a navigation page name (human-authored, e.g. "About Us") to the
 * public URL segment used by `getStaticPaths` / `res.revalidate`.
 *
 * Kept centralised so `[...slug].tsx`, the sitemap generator, and the
 * on-demand revalidation helpers all produce byte-identical paths — any
 * drift here would mean `res.revalidate("/about-us")` silently misses the
 * page actually rendered at `/about-us`.
 */
export function pageNameToPath(pageName: string): string {
    return '/' + pageName.replace(/ /g, '-').toLowerCase();
}

/** Inverse for the home page, which renders at `/` rather than `/home`. */
export function isHomePage(pageName: string): boolean {
    return pageName.toLowerCase() === 'home';
}
