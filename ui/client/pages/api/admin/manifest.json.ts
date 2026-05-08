import type {NextApiRequest, NextApiResponse} from 'next';

/**
 * `/api/admin/manifest.json` — PWA manifest for the admin SPA. Served
 * as a dynamic JSON route so future per-tenant theming (name,
 * theme_color) can read site flags without a build/deploy. For now it
 * returns a static document that lets iOS Safari + Android Chrome
 * offer "Add to Home Screen" → standalone install.
 *
 * Lives under `pages/api/admin/` (not `pages/admin/`) because Next's
 * pages router only invokes the `(req, res) => …` handler shape for
 * files under `pages/api/`. A handler in `pages/admin/` would be
 * interpreted as a React page module and 500 on render — surfaced by
 * the e2e spec for this exact reason.
 *
 * The admin pages reference this manifest via `<link rel="manifest"
 * href="/api/admin/manifest.json">` only on admin routes. The public
 * storefront keeps its own `public/manifest.json`.
 *
 * Long-cache the manifest at the edge — content rarely changes; clients
 * pick up updates via the standard manifest re-fetch on app open.
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse): void {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({
        name: 'Funisimo CMS Admin',
        short_name: 'CMS Admin',
        start_url: '/admin/',
        scope: '/admin/',
        display: 'standalone',
        background_color: '#f7f3e8',
        theme_color: '#c65a2a',
        orientation: 'any',
        // Use the existing icon assets uploaded for the public site so
        // the admin Add-to-Home-Screen card has a recognizable mark.
        icons: [
            {src: '/api/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable'},
            {src: '/api/icon-512-transparent-bg.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
        ],
    });
}
