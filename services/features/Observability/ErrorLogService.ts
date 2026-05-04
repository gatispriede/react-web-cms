import {Collection, Db} from 'mongodb';
import {IErrorLog, ErrorSource, ErrorLevel} from '@interfaces/IErrorLog';
import guid from '@utils/guid';

/**
 * Persists structured errors from every CMS surface (public-site browser,
 * admin browser, SSR / Apollo resolvers, MCP tools) into a single
 * `ErrorLog` collection so an operator can answer "did anything break in
 * the last 24 hours?" without spelunking server stdout.
 *
 * Storage decisions
 *  - **TTL index on `ts`** — entries auto-expire after 30 days. The collection
 *    is a forensic buffer, not a permanent record; long-tail debugging
 *    happens in git + the deploy artefact, not here.
 *  - **No payload sanitisation here.** Callers (the `/api/log/error`
 *    endpoint + the in-process resolver wrappers) already strip secrets
 *    before handing us a payload. Re-checking would duplicate logic.
 *  - **Bounded `extra` size** — capped at 4 KB per row so a misbehaving
 *    client posting megabyte payloads can't fill the disk. Anything
 *    larger gets summarised and a `truncated: true` marker added.
 */

const EXTRA_CAP_BYTES = 4096;

export interface ListErrorsOpts {
    limit?: number;
    source?: ErrorSource;
    level?: ErrorLevel;
    scope?: string;
    sinceISO?: string;
}

export class ErrorLogService {
    private readonly col: Collection;

    constructor(db: Db) {
        this.col = db.collection('ErrorLog');
        // 30-day TTL on `ts`. Mongo evaluates TTL once a minute, so a
        // freshly created collection without the index would grow
        // unbounded until the operator notices. Calling it on every
        // service construction is idempotent.
        this.col.createIndex({ts: 1}, {expireAfterSeconds: 60 * 60 * 24 * 30}).catch(() => {/* index already exists */});
        this.col.createIndex({source: 1, ts: -1}).catch(() => {/* already exists */});
        this.col.createIndex({level: 1, ts: -1}).catch(() => {/* already exists */});
    }

    /**
     * Insert an error row. Never throws — a failed insert just falls
     * through to a console.warn so the original failure isn't masked
     * by a logger-of-loggers cascade.
     */
    async insert(input: Omit<IErrorLog, 'id' | 'ts'> & {ts?: string}): Promise<string | null> {
        try {
            const id = guid();
            const ts = input.ts ?? new Date().toISOString();

            // Cap `extra` size — large payloads are usually copy-pasted
            // request bodies, not load-bearing context.
            let extra = input.extra;
            if (extra) {
                const json = JSON.stringify(extra);
                if (json.length > EXTRA_CAP_BYTES) {
                    extra = {
                        truncated: true,
                        original_size: json.length,
                        sample: json.slice(0, EXTRA_CAP_BYTES - 200) + '…',
                    } as any;
                }
            }

            const doc: IErrorLog = {
                id,
                ts,
                source: input.source,
                level: input.level,
                message: String(input.message ?? '').slice(0, 2000),
                stack: input.stack ? String(input.stack).slice(0, 8000) : undefined,
                scope: input.scope,
                route: input.route,
                userId: input.userId,
                userKind: input.userKind,
                userAgent: input.userAgent ? String(input.userAgent).slice(0, 500) : undefined,
                buildId: input.buildId,
                extra,
            };
            await this.col.insertOne(doc as any);
            return id;
        } catch (err) {
            // Avoid logger-of-loggers infinite recursion — write to
            // stderr directly.
             
            console.warn('[ErrorLogService] insert failed:', err);
            return null;
        }
    }

    async list(opts: ListErrorsOpts = {}): Promise<IErrorLog[]> {
        const filter: Record<string, unknown> = {};
        if (opts.source) filter.source = opts.source;
        if (opts.level) filter.level = opts.level;
        if (opts.scope) filter.scope = opts.scope;
        if (opts.sinceISO) filter.ts = {$gte: opts.sinceISO};

        const cursor = this.col
            .find(filter, {projection: {_id: 0}})
            .sort({ts: -1})
            .limit(Math.min(opts.limit ?? 100, 500));
        return (await cursor.toArray()) as unknown as IErrorLog[];
    }

    /** Operator helper — used by the admin "Clear" button on the errors page. */
    async clear(): Promise<number> {
        const r = await this.col.deleteMany({});
        return r.deletedCount ?? 0;
    }
}
