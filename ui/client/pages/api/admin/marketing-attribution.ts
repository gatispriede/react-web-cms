import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {sessionFromReq} from '@services/features/Auth/authz';
import {adminAuthOptions as authOptions} from '../auth/authOptions';
import {log} from '@services/infra/logger';

/**
 * W6c — admin attribution report endpoint. Read-only.
 *
 * Mirrors the `marketing.attribution.list` MCP tool — same shape so the
 * admin pane and the AI client see identical numbers.
 *
 * Auth: any signed-in admin/editor/viewer. Customers + anonymous → 401.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({error: 'GET only'});
    }
    try {
        const session = await sessionFromReq(req, res, authOptions);
        if (!session || session.kind === 'anonymous' || (session as any).user?.kind === 'customer') {
            return res.status(401).json({error: 'unauthorized'});
        }
    } catch {
        return res.status(401).json({error: 'unauthorized'});
    }
    const groupByRaw = String(req.query.groupBy ?? 'source');
    const groupBy = (groupByRaw === 'campaign' || groupByRaw === 'ref') ? groupByRaw : 'source';
    const range = String(req.query.range ?? '30d');
    try {
        const conn = getMongoConnection() as any;
        const svc = conn.featureServices?.marketing;
        if (!svc?.report) {
            return res.status(200).json({rows: [], total: 0, disabled: true});
        }
        const report = await svc.report({groupBy, range});
        return res.status(200).json({groupBy, range, ...report});
    } catch (err) {
        log.warn({scope: 'api.marketing.attribution', err}, 'attribution report failed');
        return res.status(500).json({error: 'report failed'});
    }
}
