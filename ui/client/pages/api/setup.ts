import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({error: 'Method not allowed'});
    }

    try {
        const connection = getMongoConnection();
        // setupClient is fire-and-forget in the constructor; poll briefly for readiness.
        for (let i = 0; i < 50 && !connection.userService; i++) {
            await new Promise((r) => setTimeout(r, 100));
        }

        if (!connection.userService) {
            return res.status(503).json({error: 'Mongo not ready'});
        }

        const admin = await connection.userService.setupAdmin();
        if (!admin) {
            return res.status(500).json({error: 'Failed to seed admin'});
        }
        return res.status(200).json({
            ok: true,
            admin: {id: admin.id, name: admin.name, email: admin.email},
        });
    } catch (err) {
        console.error('[api/setup] error:', err);
        return res.status(500).json({error: String(err)});
    }
}
