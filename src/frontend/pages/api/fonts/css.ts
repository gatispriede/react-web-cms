import type {NextApiRequest, NextApiResponse} from 'next';

/**
 * GDPR-friendly proxy for `fonts.googleapis.com/css2`. Fetches the
 * stylesheet server-side and rewrites every `fonts.gstatic.com` URL in
 * the body to point at our companion `/api/fonts/file` proxy so the
 * visitor's browser never contacts Google directly — keeping their IP
 * out of Google's logs. Gated on the public site by
 * `siteFlags.selfHostFonts`; when off, `_document.tsx` serves the
 * canonical CDN URL instead.
 *
 * Caching: Google Fonts CSS changes rarely. We set an aggressive cache
 * header (1 day public, 7-day stale-while-revalidate) so repeat visits
 * don't re-proxy — the first visit pays the proxy cost, everyone else
 * rides the CDN. No authz — public endpoint by design.
 *
 * Security: we only accept `family=` params; the query string is
 * reconstructed from a strict allowlist of characters so a malicious
 * caller can't coerce us into fetching an arbitrary URL.
 */

const GOOGLE_CSS_BASE = 'https://fonts.googleapis.com/css2';
const GOOGLE_FONT_HOST = 'https://fonts.gstatic.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({error: 'Method not allowed'});
    }

    // Reconstruct the upstream URL from a sanitised query so we can't be
    // tricked into fetching an arbitrary endpoint. The css2 endpoint only
    // needs `family=` (possibly many) + `display=`.
    const raw = req.query;
    const familyValues = Array.isArray(raw.family) ? raw.family : raw.family ? [raw.family] : [];
    const display = typeof raw.display === 'string' ? raw.display : 'swap';
    if (familyValues.length === 0) return res.status(400).send('/* Missing family parameter */');

    const safe = /^[\w\s+:@;,\-]+$/;
    const params: string[] = [];
    for (const v of familyValues) {
        const s = String(v);
        if (!safe.test(s)) return res.status(400).send('/* Invalid family parameter */');
        params.push(`family=${encodeURIComponent(s).replace(/%20/g, '+')}`);
    }
    if (!safe.test(display)) return res.status(400).send('/* Invalid display parameter */');
    params.push(`display=${encodeURIComponent(display)}`);

    const upstream = `${GOOGLE_CSS_BASE}?${params.join('&')}`;

    try {
        // Forward the visitor's `User-Agent` so Google returns the right
        // `@font-face` variants (woff2 vs. legacy formats depend on UA).
        const r = await fetch(upstream, {
            headers: {
                'User-Agent': req.headers['user-agent'] ?? 'Mozilla/5.0',
                'Accept': 'text/css,*/*;q=0.1',
            },
        });
        if (!r.ok) {
            return res.status(r.status).send(`/* Upstream Google Fonts CSS returned ${r.status} */`);
        }
        const css = await r.text();

        // Rewrite every gstatic URL to the proxy. Matches both naked urls
        // and quoted ones in `src: url("https://fonts.gstatic.com/...")`.
        const rewritten = css.replace(
            /https:\/\/fonts\.gstatic\.com\/[^\s)"']+/g,
            (match) => `/api/fonts/file?url=${encodeURIComponent(match)}`,
        );

        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        return res.status(200).send(rewritten);
    } catch (err) {
        console.error('[api/fonts/css] proxy failed:', err);
        return res.status(502).send('/* Google Fonts proxy unavailable */');
    }
}
