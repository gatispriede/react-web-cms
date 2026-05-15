import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

/**
 * Edge-middleware lookup endpoint — W8h SEO program § redirect map.
 *
 * The middleware itself runs in the Edge runtime which can't talk to
 * Mongo directly; it consults this endpoint with the inbound path and
 * either gets back a redirect target or a 204. We keep the response
 * tiny + cacheable (5s s-maxage) so the middleware adds at most one
 * round-trip per cold-cache request.
 *
 * NOT a redirect itself — returns JSON `{to, code}` (or 204). The
 * actual `NextResponse.redirect()` happens in the middleware so the
 * redirect is one hop, not two.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    const path = typeof req.query.path === 'string' ? req.query.path : '';
    if (!path) {
        res.status(400).json({error: 'path is required'});
        return;
    }
    try {
        const conn = getMongoConnection();
        const svc = conn.redirectsService;
        if (!svc) {
            // Service not booted yet — treat as no-match.
            res.status(204).end();
            return;
        }
        const row = await svc.findActive(path);
        if (!row) {
            res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');
            res.status(204).end();
            return;
        }
        res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');
        res.status(200).json({to: row.to, code: row.code});
    } catch (err) {
        // Never block the request on a redirect-table read failure.
        res.status(204).end();

        console.error('[redirect-lookup]', err);
    }
}
