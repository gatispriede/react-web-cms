/**
 * Admin-side read/delete view for the `Inquiries` Mongo collection.
 *
 * Every public-form submission inserts an audit row at `/api/inquiry`
 * regardless of whether the SMTP send succeeded. This endpoint surfaces
 * those rows to the admin so the operator can:
 *   - See incoming inquiries without depending on the inbox
 *   - Recover messages whose SMTP send failed (the row carries the full
 *     payload + the SMTP error)
 *
 * GET    /api/inquiries          — list latest 100, newest first
 * GET    /api/inquiries?id=xxx   — read one (full payload)
 * DELETE /api/inquiries?id=xxx   — remove one (audit hygiene)
 *
 * All methods require admin role.
 */

import type {NextApiRequest, NextApiResponse} from 'next';
import {requireRole} from './_authHelpers';
import {requireSameOrigin} from './_origin';
import {clientIp, rateLimit} from './_rateLimit';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

const COLLECTION = 'Inquiries';
const MAX_LIMIT = 200;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!requireSameOrigin(req, res)) return;

    // Rate-limit lightly — admin tools shouldn't get caught by it but a
    // runaway poll-every-100ms in dev would still benefit from a cap.
    const rl = rateLimit(`inquiries:${clientIp(req)}`, 60, 60_000);
    if (!rl.ok) {
        res.setHeader('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
        return res.status(429).json({error: 'Too many requests'});
    }

    const auth = await requireRole(req, res, 'admin');
    if (!auth.ok) return;

    const connection = getMongoConnection();
    for (let i = 0; i < 30 && !connection.database; i++) {
        await new Promise(r => setTimeout(r, 100));
    }
    const db = connection.database;
    if (!db) {
        return res.status(503).json({error: 'Database not ready'});
    }

    const id = typeof req.query.id === 'string' ? req.query.id : '';

    try {
        if (req.method === 'DELETE') {
            // Two delete shapes: `?id=xxx` deletes one row, `?all=true`
            // wipes the whole collection. The latter is admin-only (see
            // requireRole above) and intentionally non-recoverable; the
            // admin UI fronts it with a Popconfirm.
            if (req.query.all === 'true' || req.query.all === '1') {
                const result = await db.collection(COLLECTION).deleteMany({});
                return res.status(200).json({deleted: result.deletedCount ?? 0});
            }
            if (!id) return res.status(400).json({error: 'Missing id'});
            const result = await db.collection(COLLECTION).deleteOne({id});
            return res.status(200).json({deleted: result.deletedCount ?? 0});
        }

        if (req.method !== 'GET') {
            res.setHeader('Allow', 'GET, DELETE');
            return res.status(405).json({error: 'Method not allowed'});
        }

        if (id) {
            const row = await db
                .collection(COLLECTION)
                .findOne({id}, {projection: {_id: 0}});
            if (!row) return res.status(404).json({error: 'Not found'});
            return res.status(200).json(row);
        }

        // List — newest first, capped. Truncate the message field for the
        // list payload so a flood of long messages doesn't bloat the
        // response; full message is fetched on detail-view click.
        const limit = Math.min(
            MAX_LIMIT,
            Math.max(1, Number(req.query.limit ?? 100)),
        );
        const rows = await db
            .collection(COLLECTION)
            .find({}, {projection: {_id: 0}})
            .sort({createdAt: -1})
            .limit(limit)
            .toArray();
        const summary = rows.map((r: any) => ({
            id: r.id,
            createdAt: r.createdAt,
            name: r.name,
            email: r.email,
            topic: r.topic,
            preview: typeof r.message === 'string'
                ? r.message.slice(0, 240)
                : '',
            recipient: r.recipient,
            ip: r.ip,
            mail: r.mail ?? null,
        }));
        return res.status(200).json({rows: summary});
    } catch (err) {
        console.error('[api/inquiries]', err);
        return res.status(500).json({error: String((err as Error).message ?? err)});
    }
}
