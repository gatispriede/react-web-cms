import type {NextApiRequest, NextApiResponse} from 'next';
import {requireRole} from './_authHelpers';
import {getMongoConnection} from '../../../Server/mongoDBConnection';

export const config = {
    api: {
        responseLimit: false,
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({error: 'Method not allowed'});
    }

    const auth = await requireRole(req, res, 'editor');
    if (!auth.ok) return;

    try {
        const connection = getMongoConnection();
        for (let i = 0; i < 50 && !connection.bundleService; i++) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (!connection.bundleService) return res.status(503).json({error: 'Mongo not ready'});

        const bundle = await connection.bundleService.export();
        const filename = `site-${bundle.manifest.exportedAt.slice(0, 10)}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(JSON.stringify(bundle));
    } catch (err) {
        console.error('[api/export] error:', err);
        return res.status(500).json({error: String(err)});
    }
}
