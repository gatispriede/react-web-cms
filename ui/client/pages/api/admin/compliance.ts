/**
 * Wave 8b — Admin compliance API.
 *
 * GET ?view=deletions&limit=N → pending deletion requests + lastSweepAt
 * POST {action: 'retention-sweep'} → runs the retention sweep
 * POST {action: 'confirm-deletion', userId} → flips DeletionRequests row to purged
 * POST {action: 'cancel-deletion', userId} → cancels pending deletion
 *
 * Admin-only. Anonymous 401, customer 403.
 */
import type {NextApiRequest, NextApiResponse} from 'next';
import {sessionFromReq} from '@services/features/Auth/authz';
import {adminAuthOptions as authOptions} from '../auth/authOptions';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {getComplianceService} from '@services/features/Compliance/ComplianceService';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
        const session = await sessionFromReq(req, res, authOptions as never);
        if (!session || session.kind === 'anonymous') {
            res.status(401).json({error: 'unauthorized'});
            return;
        }
        if (session.kind !== 'admin') {
            res.status(403).json({error: 'admin only'});
            return;
        }
    } catch {
        res.status(401).json({error: 'unauthorized'});
        return;
    }

    const conn = getMongoConnection() as unknown as {database?: never};
    if (!conn.database) {
        res.status(503).json({error: 'database not ready'});
        return;
    }
    const svc = getComplianceService(conn.database);

    if (req.method === 'GET') {
        const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)));
        const [rows, stats] = await Promise.all([svc.listPendingDeletions(limit), svc.stats()]);
        res.status(200).json({rows, lastSweepAt: stats.lastSweepAt});
        return;
    }

    if (req.method === 'POST') {
        const body = (req.body ?? {}) as {action?: string; userId?: string};
        try {
            if (body.action === 'retention-sweep') {
                const result = await svc.runRetentionSweep();
                // Stamp lastSweepAt for the admin dashboard.
                try {
                    await (conn.database as unknown as {collection: (n: string) => {updateOne: (...a: never[]) => Promise<unknown>}})
                        .collection('SiteFlags')
                        .updateOne(
                            {key: 'compliance.lastSweepAt'} as never,
                            {$set: {key: 'compliance.lastSweepAt', value: new Date().toISOString()}} as never,
                            {upsert: true} as never,
                        );
                } catch { /* ignore */ }
                res.status(200).json(result);
                return;
            }
            if (body.action === 'confirm-deletion' && typeof body.userId === 'string') {
                const d = conn.database as unknown as {collection: (n: string) => {updateMany: (...a: never[]) => Promise<{modifiedCount?: number}>}};
                const r = await d.collection('DeletionRequests').updateMany(
                    {userId: body.userId, status: 'pending'} as never,
                    {$set: {status: 'purged', purgedAt: new Date().toISOString()}} as never,
                );
                res.status(200).json({ok: true, modified: r.modifiedCount ?? 0});
                return;
            }
            if (body.action === 'cancel-deletion' && typeof body.userId === 'string') {
                const result = await svc.cancelDeletion(body.userId);
                res.status(200).json(result);
                return;
            }
            res.status(400).json({error: 'unknown action'});
        } catch (err) {
            res.status(500).json({error: String((err as Error).message || err)});
        }
        return;
    }

    res.setHeader('Allow', 'GET,POST');
    res.status(405).json({error: 'method not allowed'});
}
