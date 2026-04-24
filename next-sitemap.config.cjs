/** @type {import('next-sitemap').IConfig} */ const {error} = require("next/dist/build/output/log");
const dev = process.env.NODE_ENV !== 'production';

const domain = 'http://localhost'

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
        const query = `{ mongo { getNavigationCollection { page } getSiteFlags } }`;
        const resp = await fetch(`${domain}/api/graphql`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({query}),
        }).then(r => r.json()).catch((err) => { console.error(err); return null; });
        const pages = resp?.data?.mongo?.getNavigationCollection ?? [];
        let layoutMode = 'tabs';
        try {
            const flags = JSON.parse(resp?.data?.mongo?.getSiteFlags || '{}');
            if (flags.layoutMode === 'scroll') layoutMode = 'scroll';
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
        return pages.map((page) => ({
            loc: '/' + page.page,
            changefreq: 'daily',
            priority: 0.7,
            lastmod,
            alternateRefs,
        }));
    }
};