import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {sessionFromReq} from '@services/features/Auth/authz';
import {adminAuthOptions as authOptions} from '../auth/authOptions';
import {log} from '@services/infra/logger';

/**
 * Admin read-only listing for the W8d performance dashboard.
 *
 * Returns the most recent N RUM beacons; no aggregation, no filters
 * beyond `limit` — the in-pane table sorts/filters client-side. This
 * stays cheap to call (single capped find with index on `ingestedAt`)
 * so the dashboard can poll without flooding Mongo.
 *
 * Auth: any signed-in admin/editor/viewer can read — RUM samples carry
 * no PII (path + metric + timestamp + UA prefix). Anonymous sessions
 * 401.
 */

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({error: 'GET only'});
    }

    try {
        const session = await sessionFromReq(req, res, authOptions);
        if (!session || session.kind === 'anonymous') {
            return res.status(401).json({error: 'unauthorized'});
        }
    } catch {
        return res.status(401).json({error: 'unauthorized'});
    }

    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    try {
        const mongo = getMongoConnection();
        const db = mongo.database;
        if (!db) {
            return res.status(200).json({rows: []});
        }
        const rows = await db.collection('perf_beacons')
            .find({}, {projection: {_id: 0}})
            .sort({ingestedAt: -1})
            .limit(limit)
            .toArray();
        return res.status(200).json({rows});
    } catch (err) {
        log.warn({scope: 'api.perf.beacons', err}, 'failed to list perf beacons');
        return res.status(500).json({error: 'list failed'});
    }
}
