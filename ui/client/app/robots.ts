import type {MetadataRoute} from 'next';

/**
 * Robots — W8h SEO program § robots.txt.
 *
 * App Router migration, Batch 3 — moved from `pages/robots.ts` to
 * `app/robots.ts`. The file's shape (`export default function robots():
 * MetadataRoute.Robots`) is the App Router metadata-file convention.
 * Living under `pages/` was a historical accident — Pages Router doesn't
 * recognise this shape, so it was only ever functional under App-Router
 * resolution. The move makes the path canonical.
 *
 * Env-gated:
 *   - production: allow everything except admin / api / customer-account
 *   - everything else (dev / staging / preview): Disallow: /
 *
 * Env precedence: SITE_ENV → NEXT_PUBLIC_ENV → NODE_ENV. Sitemap URL
 * built from SITE_URL / NEXT_PUBLIC_SITE_URL (same env var as the
 * next-sitemap config).
 */
function resolveEnv(): 'production' | 'staging' | 'preview' | 'development' {
    const site = (process.env.SITE_ENV || process.env.NEXT_PUBLIC_ENV || '').toLowerCase();
    if (site === 'production' || site === 'staging' || site === 'preview' || site === 'development') {
        return site as 'production' | 'staging' | 'preview' | 'development';
    }
    return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

export default function robots(): MetadataRoute.Robots {
    const env = resolveEnv();
    const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost').replace(/\/$/, '');

    if (env !== 'production') {
        // Staging / preview / dev: disallow everything so search engines
        // don't index half-baked content. Sitemap omitted intentionally
        // — we don't want a non-prod sitemap discoverable.
        return {
            rules: [
                {userAgent: '*', disallow: '/'},
            ],
        };
    }

    // Production — selective indexing.
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/admin/',
                    '/account/',
                    '/checkout',
                    '/api/',
                    '/_next/',
                ],
            },
            // AI-bot opt-out: blocked by default per
            // docs/roadmap/storefront/seo-program.md (open question 1).
            // Operator override via site-flag is a follow-up.
            {userAgent: 'GPTBot', disallow: '/'},
            {userAgent: 'ClaudeBot', disallow: '/'},
            {userAgent: 'Google-Extended', disallow: '/'},
        ],
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
