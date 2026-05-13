import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {log} from '@services/infra/logger';

/**
 * RUM perf beacon intake — W8d.
 *
 * Receives Core Web Vitals samples from `ui/client/lib/perfBeacon.ts`.
 * Client already samples at 10 %, so this endpoint sees ~1/10 of public
 * pageviews. No per-IP rate limit beyond what the platform already has
 * upstream — beacons are fire-and-forget via `navigator.sendBeacon`, so
 * a hostile client can't outrun their own pageviews.
 *
 * Storage shape — one document per beacon in `perf_beacons`:
 *
 *   {name, value, rating, path, ts, userAgent, ingestedAt}
 *
 * If Mongo is unavailable we log to stdout — sample data is nice-to-have,
 * not load-bearing. Never fail the request: the client treats 2xx and
 * 5xx identically (silent), and an error response wastes bytes.
 */

const VALID_METRICS = new Set(['LCP', 'CLS', 'INP', 'TTFB', 'FCP', 'FID']);
const VALID_RATINGS = new Set(['good', 'needs-improvement', 'poor']);

interface Beacon {
    name?: string;
    value?: number;
    rating?: string;
    path?: string;
    ts?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({error: 'POST only'});
    }

    // `sendBeacon` posts as Blob (text/plain or application/json). Next
    // auto-parses JSON bodies when the Content-Type is set; for blob the
    // raw text shows up on req.body as a string. Handle both.
    let body: Beacon;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
    } catch {
        return res.status(200).json({ok: false, reason: 'parse'});
    }

    if (!body.name || !VALID_METRICS.has(body.name)) {
        return res.status(200).json({ok: false, reason: 'metric'});
    }
    if (typeof body.value !== 'number' || !Number.isFinite(body.value)) {
        return res.status(200).json({ok: false, reason: 'value'});
    }
    if (body.rating && !VALID_RATINGS.has(body.rating)) {
        body.rating = undefined;
    }

    const doc = {
        name: body.name,
        value: body.value,
        rating: body.rating,
        path: typeof body.path === 'string' ? body.path.slice(0, 256) : '/',
        ts: typeof body.ts === 'number' ? body.ts : Date.now(),
        userAgent: (req.headers['user-agent'] as string | undefined)?.slice(0, 256),
        ingestedAt: new Date(),
    };

    try {
        const mongo = getMongoConnection();
        const db = mongo.database;
        if (db) {
            await db.collection('perf_beacons').insertOne(doc);
        } else {
            // Mongo not connected yet (boot race) — log to stdout so log
            // shippers still see the sample. Sample data isn't load-bearing.
            log.info({scope: 'perf.beacon', ...doc}, 'rum beacon (no-mongo fallback)');
        }
    } catch (err) {
        log.warn({scope: 'perf.beacon', err}, 'failed to persist perf beacon');
    }

    return res.status(204).end();
}
