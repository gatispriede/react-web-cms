import type {NextApiRequest, NextApiResponse} from 'next';

/**
 * Companion proxy to `/api/fonts/css`. Fetches a single font file from
 * `fonts.gstatic.com` server-side and streams it back to the client so
 * the visitor's browser never talks to Google. Only accepts URLs that
 * belong to `fonts.gstatic.com` — any other host is rejected so this
 * can't be repurposed as an open proxy.
 *
 * Font binaries are content-addressable (Google includes a hash in the
 * path) and effectively immutable, so we cache for a year with
 * `immutable` — repeat visits read from the browser cache, not us.
 */

const ALLOWED_HOST = 'fonts.gstatic.com';

export const config = {
    api: {
        // Default response-size cap is 4 MB; font files are typically <200 kB
        // but variable fonts with many subsets can push past that. 16 MB is
        // a comfortable ceiling; the Content-Length on gstatic never gets
        // close.
        responseLimit: '16mb',
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({error: 'Method not allowed'});
    }

    const raw = typeof req.query.url === 'string' ? req.query.url : '';
    if (!raw) return res.status(400).send('Missing url parameter');

    let parsed: URL;
    try { parsed = new URL(raw); } catch { return res.status(400).send('Invalid url parameter'); }
    if (parsed.protocol !== 'https:' || parsed.host !== ALLOWED_HOST) {
        return res.status(400).send('Only fonts.gstatic.com urls are allowed');
    }

    try {
        const r = await fetch(parsed.toString());
        if (!r.ok) {
            return res.status(r.status).send(`Upstream font fetch returned ${r.status}`);
        }
        const buf = Buffer.from(await r.arrayBuffer());
        const type = r.headers.get('content-type') ?? 'font/woff2';
        res.setHeader('Content-Type', type);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).send(buf);
    } catch (err) {
        console.error('[api/fonts/file] proxy failed:', err);
        return res.status(502).send('Font proxy unavailable');
    }
}
