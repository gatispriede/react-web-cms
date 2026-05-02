import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {sessionFromReq} from '@services/features/Auth/authz';
import {authOptions} from '../auth/authOptions';
import {log} from '@services/infra/logger';
import type {ErrorLevel, ErrorSource} from '@interfaces/IErrorLog';

/**
 * Single intake for client + admin browser failures.
 *
 * Auth model
 *   - Anonymous public-site visitors are allowed in (we still want their
 *     unhandled-rejection traces). They get throttled by IP via the
 *     same lightweight bucket the signin route uses, and their
 *     `userId` is left blank.
 *   - Admin sessions decorate the row with `userId` + `userKind` so the
 *     errors page can filter by author.
 *
 * Sampling
 *   `LOG_SAMPLE_RATE` env (default 1.0) — fraction in [0, 1]; rows below
 *   the cut are dropped silently. Lets a busy site shed noise without
 *   touching client code.
 *
 * Body shape (all fields optional except `message` + `source` + `level`):
 *
 *   {source: 'client'|'admin', level: 'error'|'warn',
 *    message, stack?, scope?, route?, extra?}
 */

interface RequestBody {
    source?: ErrorSource;
    level?: ErrorLevel;
    message?: string;
    stack?: string;
    scope?: string;
    route?: string;
    userAgent?: string;
    buildId?: string;
    extra?: Record<string, unknown>;
}

const SAMPLE_RATE = Number(process.env.LOG_SAMPLE_RATE ?? '1') || 1;

// Lightweight in-process IP bucket — `ErrorLog` survives a process
// restart, this counter doesn't (and that's fine; intent is just to
// blunt a runaway client looping uncaught errors at us).
const ipBuckets = new Map<string, {count: number; resetAt: number}>();
const PER_IP_LIMIT = Number(process.env.LOG_ERROR_RATE_LIMIT ?? '120'); // per minute

function bucket(ip: string): {ok: boolean} {
    const now = Date.now();
    const cur = ipBuckets.get(ip);
    if (!cur || cur.resetAt < now) {
        ipBuckets.set(ip, {count: 1, resetAt: now + 60_000});
        return {ok: true};
    }
    cur.count += 1;
    return {ok: cur.count <= PER_IP_LIMIT};
}

function clientIp(req: NextApiRequest): string {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
    return (req.socket?.remoteAddress ?? 'unknown').replace('::ffff:', '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({error: 'POST only'});
    }
    if (Math.random() > SAMPLE_RATE) {
        return res.status(202).json({sampled: false});
    }

    const ip = clientIp(req);
    if (!bucket(ip).ok) {
        return res.status(429).json({error: 'rate limited'});
    }

    const body = (req.body ?? {}) as RequestBody;
    const source = body.source === 'admin' || body.source === 'mcp' ? body.source : 'client';
    const level = body.level === 'warn' ? 'warn' : 'error';

    if (!body.message) {
        return res.status(400).json({error: 'message required'});
    }

    // Decorate with the active session (best-effort — anon callers stay anonymous).
    let userId: string | undefined;
    let userKind: ('admin' | 'editor' | 'viewer' | 'customer' | 'anonymous') | undefined;
    try {
        const session = await sessionFromReq(req, res, authOptions);
        if (session && session.kind !== 'anonymous') {
            userId = (session as any).userId ?? (session as any).email;
            userKind = (session.role as any) ?? session.kind;
        }
    } catch { /* anon, fall through */ }

    try {
        const mongo = getMongoConnection();
        const id = await mongo.errorLogService.insert({
            source,
            level,
            message: body.message,
            stack: body.stack,
            scope: body.scope,
            route: body.route,
            userAgent: body.userAgent ?? (req.headers['user-agent'] as string | undefined),
            buildId: body.buildId ?? process.env.BUILD_ID,
            extra: body.extra,
            userId,
            userKind,
        });

        // Mirror to stdout so log shippers picking up container output
        // catch the entry even if Mongo goes down. No PII beyond what
        // the caller already supplied.
        log.error({
            scope: body.scope ?? `${source}.error`,
            source,
            level,
            err: {message: body.message, stack: body.stack},
            route: body.route,
            user_id: userId,
        }, body.message);

        return res.status(200).json({id});
    } catch (err) {
        log.error({scope: 'api.log.error', err}, 'failed to persist error report');
        return res.status(500).json({error: 'persist failed'});
    }
}
