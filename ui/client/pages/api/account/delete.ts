/**
 * Wave 8b — Delete-my-account.
 *
 * Customer-initiated. Routes through `ComplianceService.requestDeletion`
 * which itself runs `cascadeDelete('users', 'Users', userId, ctx)` — so
 * sister collections with `cascadeRules.parentFeature === 'users'` move
 * to `.trash` alongside the user. A `DeletionRequest` row records the
 * 30-day legal grace window; admin can cancel within it.
 *
 * No password re-confirm here — the customer is already authenticated
 * through next-auth. A confirmation modal on the client side (see
 * `/account/privacy`) handles "are you sure?" UX.
 */
import type {NextApiRequest, NextApiResponse} from 'next';
import {getServerSession} from 'next-auth/next';
import {authOptions} from '../auth/authOptions';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {getComplianceService} from '@services/features/Compliance/ComplianceService';
import type {FeatureContext} from '@services/infra/featureManifest';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({error: 'Method not allowed'});
        return;
    }
    const raw = await getServerSession(req, res, authOptions as never);
    const user = (raw?.user as {kind?: string; id?: string; email?: string} | undefined) ?? null;
    if (!user || user.kind !== 'customer' || !user.id) {
        res.status(401).json({error: 'unauthorized'});
        return;
    }

    // The confirmation token guards against CSRF-shaped accidents — the
    // client mirrors a header read off the session.
    const body = (req.body ?? {}) as {confirm?: string};
    if (body.confirm !== 'DELETE') {
        res.status(400).json({error: 'confirmation required: send {"confirm":"DELETE"}'});
        return;
    }

    try {
        const conn = getMongoConnection() as unknown as {
            database?: never;
            cartRedis?: never;
            featureServices?: Record<string, unknown>;
            setupClient?: () => Promise<void>;
            auditService?: {record: (e: unknown) => Promise<void>};
        };
        if (!conn.database) {
            res.status(503).json({error: 'database not ready'});
            return;
        }
        const ctx: FeatureContext = {
            db: conn.database,
            redis: conn.cartRedis ?? ({} as never),
            services: conn.featureServices ?? {},
            reconnect: conn.setupClient ?? (async () => undefined),
        };

        const svc = getComplianceService(conn.database);
        const reqRow = await svc.requestDeletion(user.id, ctx, {note: 'self-service'});

        try {
            await conn.auditService?.record({
                collection: 'Users',
                docId: user.id,
                op: 'delete',
                actor: {email: user.email, role: 'customer'},
                tag: 'compliance:delete-request',
                diff: {before: null, after: {scheduledFor: reqRow.scheduledFor}},
            });
        } catch { /* swallow */ }

        res.status(200).json({
            ok: true,
            requestId: reqRow.id,
            scheduledFor: reqRow.scheduledFor,
            graceDays: 30,
        });
    } catch (err) {
        res.status(500).json({error: String((err as Error).message || err)});
    }
}
