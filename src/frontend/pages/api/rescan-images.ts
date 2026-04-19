import type {NextApiRequest, NextApiResponse} from 'next';
import {requireRole} from './_authHelpers';
import {requireSameOrigin} from './_origin';
import {getMongoConnection} from '../../../Server/mongoDBConnection';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({error: 'Method not allowed'});
    }
    if (!requireSameOrigin(req, res)) return;
    const auth = await requireRole(req, res, 'editor');
    if (!auth.ok) return;

    try {
        const connection = getMongoConnection();
        for (let i = 0; i < 50 && !connection.assetService; i++) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (!connection.assetService) return res.status(503).json({error: 'Mongo not ready'});
        const session = (req as any).session?.user?.email;
        const summary = await connection.assetService.rescanDiskImages(session);
        return res.status(200).json({ok: true, ...summary});
    } catch (err) {
        console.error('[api/rescan-images] error:', err);
        return res.status(500).json({error: String(err)});
    }
}
