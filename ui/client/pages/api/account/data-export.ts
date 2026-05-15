/**
 * Wave 8b — Authenticated customer data export (GDPR Article 20).
 *
 * Returns a JSON manifest of every personal-data record keyed to the
 * caller. Audit-logged. Customer-scope only — admins use the MCP
 * `compliance.dataExport.run` tool for operator-mediated exports.
 */
import type {NextApiRequest, NextApiResponse} from 'next';
import {getServerSession} from 'next-auth/next';
import {authOptions} from '../auth/authOptions';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {getComplianceService} from '@services/features/Compliance/ComplianceService';

export const config = {
    api: {responseLimit: false},
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET,POST');
        res.status(405).json({error: 'Method not allowed'});
        return;
    }
    const raw = (await getServerSession(req, res, authOptions as never)) as
        | {user?: {kind?: string; id?: string; email?: string}}
        | null;
    const user = raw?.user ?? null;
    if (!user || user.kind !== 'customer' || !user.id) {
        res.status(401).json({error: 'unauthorized'});
        return;
    }

    try {
        const conn = getMongoConnection();
        const db = (conn as unknown as {database?: unknown}).database as never;
        if (!db) {
            res.status(503).json({error: 'database not ready'});
            return;
        }
        const svc = getComplianceService(db);
        const data = await svc.exportUserData(user.id);

        // Best-effort audit. Never block the export on audit failure.
        try {
            const audit = (conn as unknown as {auditService?: {record: (e: unknown) => Promise<void>}}).auditService;
            await audit?.record({
                collection: 'Users',
                docId: user.id,
                op: 'create',
                actor: {email: user.email, role: 'customer'},
                tag: 'compliance:data-export',
                diff: {before: null, after: {recordCounts: {
                    orders: data.orders.length,
                    inquiries: data.inquiries.length,
                    attribution: data.marketingAttribution.length,
                }}},
            });
        } catch { /* swallow */ }

        const filename = `data-export-${user.id}-${new Date().toISOString().slice(0, 10)}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(JSON.stringify(data, null, 2));
    } catch (err) {
        res.status(500).json({error: String((err as Error).message || err)});
    }
}
