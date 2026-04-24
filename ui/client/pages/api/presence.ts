import type {NextApiRequest, NextApiResponse} from 'next';
import {getServerSession} from 'next-auth/next';
import {authOptions} from './auth/[...nextauth]';
import {requireSameOrigin} from './_origin';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {clientIp, rateLimit} from './_rateLimit';

/**
 * Layer 2 presence API.
 *
 *   POST /api/presence   { docId: string }
 *     Heartbeat — upsert `{email, docId, at: now}` into the Presence
 *     collection. Called by the admin UI every ~15 s.
 *   GET  /api/presence?docId=<id>
 *     Return the list of peers active on this docId (TTL-pruned). Includes
 *     the caller; the UI filters self by email.
 *
 * Requires an editor-role session. Rate-limited per IP at 120 req/min so
 * a runaway tab can't hammer Mongo.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({error: 'Method not allowed'});
    }
    if (req.method === 'POST' && !requireSameOrigin(req, res)) return;

    const session = await getServerSession(req, res, authOptions);
    const email = (session?.user as any)?.email;
    const role = ((session?.user as any)?.role ?? 'viewer') as string;
    if (!email) return res.status(401).json({error: 'Unauthorized'});
    if (role !== 'editor' && role !== 'admin') {
        return res.status(403).json({error: 'Forbidden: editor role required'});
    }

    const ip = clientIp(req as any);
    const rl = rateLimit(`presence:${ip}`, 120, 60_000);
    if (!rl.ok) return res.status(429).json({error: 'Too many presence requests'});

    const connection = getMongoConnection();
    for (let i = 0; i < 50 && !connection.presenceService; i++) {
        await new Promise(r => setTimeout(r, 100));
    }
    if (!connection.presenceService) return res.status(503).json({error: 'Mongo not ready'});

    try {
        if (req.method === 'POST') {
            const docId = String((req.body as any)?.docId ?? '').slice(0, 256);
            if (!docId) return res.status(400).json({error: 'docId required'});
            await connection.presenceService.heartbeat({
                email,
                docId,
                name: (session?.user as any)?.name,
            });
            return res.status(200).json({ok: true});
        }

        const docId = String((req.query.docId ?? '')).slice(0, 256);
        if (!docId) return res.status(400).json({error: 'docId required'});
        const entries = await connection.presenceService.list({docId});
        return res.status(200).json({entries});
    } catch (err) {
        console.error('[api/presence] error:', err);
        return res.status(500).json({error: String(err)});
    }
}
