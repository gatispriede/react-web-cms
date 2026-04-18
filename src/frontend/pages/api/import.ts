import type {NextApiRequest, NextApiResponse} from 'next';
import {requireRole} from './_authHelpers';
import {requireSameOrigin} from './_origin';
import {clientIp, rateLimit} from './_rateLimit';
import {getMongoConnection} from '../../../Server/mongoDBConnection';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '200mb',
        },
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({error: 'Method not allowed'});
    }

    if (!requireSameOrigin(req, res)) return;

    const rl = rateLimit(`import:${clientIp(req)}`, 3, 60_000);
    if (!rl.ok) {
        res.setHeader('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
        return res.status(429).json({error: 'Too many import attempts, slow down'});
    }

    const auth = await requireRole(req, res, 'admin');
    if (!auth.ok) return;

    try {
        const bundle = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (!bundle?.manifest || !bundle?.site) {
            return res.status(400).json({error: 'Invalid bundle: missing manifest or site'});
        }

        const connection = getMongoConnection();
        for (let i = 0; i < 50 && !connection.bundleService; i++) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (!connection.bundleService) return res.status(503).json({error: 'Mongo not ready'});

        const summary = await connection.bundleService.import(bundle);
        return res.status(200).json({ok: true, ...summary});
    } catch (err) {
        console.error('[api/import] error:', err);
        return res.status(500).json({error: String(err)});
    }
}
