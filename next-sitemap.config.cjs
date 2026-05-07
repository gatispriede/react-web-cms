/** @type {import('next-sitemap').IConfig} */ const {error} = require("next/dist/build/output/log");
const dev = process.env.NODE_ENV !== 'production';

// Hardcoded localhost is the dev / build-on-droplet default. In production
// builds this gets overridden by SITE_URL (preferred) or NEXT_PUBLIC_SITE_URL
// — both refer to the public-facing canonical (e.g. https://funisimo.pro).
// Without this Google sees `http://localhost/...` URLs in the sitemap and
// either ignores them or flags the site as broken.
//
// The fetch URL stays as localhost because next-sitemap runs on the build
// host and talks to the build-time GraphQL server on the same box; it's
// only `siteUrl` and the `<loc>` entries that need the public origin.
const domain = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost'
const fetchOrigin = 'http://localhost'

module.exports = {
    siteUrl: domain,
    generateRobotsTxt: true,
    sourceDir: "ui/client/.next",
    outDir: "ui/client/public/images",
    additionalPaths: async (config) => {
        // Sitemap content depends on the site layout mode: in "tabs" mode
        // every nav page is its own URL so we emit one entry per page; in
        // "scroll" mode all pages stack on `/`, so we only emit the root
        // (URL fragments aren't valid sitemap locs). Legacy `/<slug>` routes
        // in scroll mode redirect client-side to `/#<slug>` — see
        // `src/frontend/pages/[...slug].tsx`.
        const query = `{ mongo { getNavigationCollection { page } getSiteFlags getPosts(limit: 200) } }`;
        const resp = await fetch(`${fetchOrigin}/api/graphql`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({query}),
        }).then(r => r.json()).catch((err) => { console.error(err); return null; });
        const pages = resp?.data?.mongo?.getNavigationCollection ?? [];
        let layoutMode = 'tabs';
        let blogEnabled = true;
        try {
            const flags = JSON.parse(resp?.data?.mongo?.getSiteFlags || '{}');
            if (flags.layoutMode === 'scroll') layoutMode = 'scroll';
            if (flags.blogEnabled === false) blogEnabled = false;
        } catch { /* noop */ }

        const alternateRefs = [
            {href: `${domain}/en/`, hreflang: 'en'},
            {href: `${domain}/lv/`, hreflang: 'lv'},
        ];
        const lastmod = new Date().toISOString();

        if (layoutMode === 'scroll') {
            return [{
                loc: '/',
                changefreq: 'daily',
                priority: 0.8,
                lastmod,
                alternateRefs,
            }];
        }
        const navEntries = pages.map((page) => ({
            loc: '/' + page.page,
            changefreq: 'daily',
            priority: 0.7,
            lastmod,
            alternateRefs,
        }));

        let postEntries = [];
        if (blogEnabled) {
            try {
                const posts = JSON.parse(resp?.data?.mongo?.getPosts || '[]');
                postEntries = posts
                    .filter((p) => p.slug && !p.draft)
                    .map((p) => ({
                        loc: `/blog/${p.slug}`,
                        changefreq: 'weekly',
                        priority: 0.6,
                        lastmod: p.updatedAt ?? lastmod,
                    }));
                if (posts.length > 0) {
                    postEntries.unshift({
                        loc: '/blog',
                        changefreq: 'daily',
                        priority: 0.7,
                        lastmod,
                    });
                }
            } catch { /* noop */ }
        }

        return [...navEntries, ...postEntries];
    }
};