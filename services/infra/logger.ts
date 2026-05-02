/**
 * Structured logger — single source of truth for both standalone server
 * and the Next API routes. Newline-delimited JSON in production so log
 * shippers (Logtail / Loki / Stackdriver) can parse straight off stdout;
 * pretty-printed text in dev so the human reading `next dev` console
 * doesn't drown.
 *
 * No external deps — `pino` is great but adds 28 KB to the bundle and
 * we use ~5% of its surface. Hand-rolled keeps the dependency graph
 * lean and makes the wire format trivially auditable.
 *
 * Conventions
 *   log.info({scope: 'theme.save', user_id, doc_id, ms}, 'theme saved')
 *   log.error({scope: 'theme.save', user_id, err}, 'theme save failed')
 *
 * `scope` is the dot-namespaced verb-or-noun that names what failed.
 * `err` is special-cased: an `Error` instance is unwrapped into
 * `{message, name, stack}` so the JSON line is grep-friendly.
 *
 * Per-request child loggers carry `req_id` + optional `user_id` /
 * `session_kind` so every log line from one request is correlatable.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {debug: 10, info: 20, warn: 30, error: 40};
const ENV_LEVEL: LogLevel = (() => {
    const raw = (process.env.LOG_LEVEL ?? '').toLowerCase();
    if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
    return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
})();
const PRETTY = process.env.NODE_ENV !== 'production' && process.env.LOG_FORMAT !== 'json';

export interface LogContext {
    [key: string]: unknown;
}

function unwrapErr(err: unknown): {message: string; name?: string; stack?: string} {
    if (err instanceof Error) {
        return {message: err.message, name: err.name, stack: err.stack};
    }
    if (err && typeof err === 'object') {
        const e = err as any;
        return {message: String(e.message ?? e), name: e.name, stack: e.stack};
    }
    return {message: String(err)};
}

function formatPretty(level: LogLevel, msg: string, ctx: LogContext): string {
    const colour = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : level === 'debug' ? '\x1b[90m' : '\x1b[36m';
    const reset = '\x1b[0m';
    const tag = `${colour}${level.toUpperCase().padEnd(5)}${reset}`;
    const scope = (ctx.scope as string | undefined) ?? '-';
    const extras = Object.entries(ctx)
        .filter(([k]) => k !== 'scope' && k !== 'err')
        .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(' ');
    const errOut = ctx.err ? `\n  ${(ctx.err as any).stack || (ctx.err as any).message || ''}` : '';
    return `${tag} ${scope.padEnd(20)} ${msg} ${extras}${errOut}`;
}

// Browser bundles include `services/api/client/*`, which transitively
// imports this module. `process.stdout/stderr.write` doesn't exist in
// the browser — we fall through to `console.*` there so the call still
// surfaces (the global `window.onerror` reporter installed by
// `reportError.ts` then sends it to /api/log/error). On the server we
// keep the structured stdout/stderr stream — that's what log shippers
// (Logtail, Loki, Stackdriver) parse.
const IS_BROWSER = typeof window !== 'undefined'
    || typeof process === 'undefined'
    || typeof process.stdout?.write !== 'function';

function emit(level: LogLevel, msg: string, ctx: LogContext): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[ENV_LEVEL]) return;

    const payload: LogContext = {...ctx};
    if (payload.err) payload.err = unwrapErr(payload.err);

    if (IS_BROWSER) {
        // eslint-disable-next-line no-console
        const sink = level === 'error' ? console.error
            : level === 'warn' ? console.warn
            : level === 'debug' ? console.debug
            : console.info;
        sink(`[${(payload.scope as string) ?? '-'}] ${msg}`, payload);
        return;
    }

    if (PRETTY) {
        const line = formatPretty(level, msg, payload);
        if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
        else process.stdout.write(line + '\n');
        return;
    }

    const json = JSON.stringify({
        ts: new Date().toISOString(),
        level,
        msg,
        ...payload,
    });
    if (level === 'error' || level === 'warn') process.stderr.write(json + '\n');
    else process.stdout.write(json + '\n');
}

export interface Logger {
    debug(ctx: LogContext, msg: string): void;
    info(ctx: LogContext, msg: string): void;
    warn(ctx: LogContext, msg: string): void;
    error(ctx: LogContext, msg: string): void;
    /** Bind extra context — every subsequent call inherits the bound fields. */
    child(extra: LogContext): Logger;
}

export function makeLogger(base: LogContext = {}): Logger {
    const merge = (ctx: LogContext) => ({...base, ...ctx});
    return {
        debug: (ctx, msg) => emit('debug', msg, merge(ctx)),
        info: (ctx, msg) => emit('info', msg, merge(ctx)),
        warn: (ctx, msg) => emit('warn', msg, merge(ctx)),
        error: (ctx, msg) => emit('error', msg, merge(ctx)),
        child: (extra) => makeLogger({...base, ...extra}),
    };
}

/** Default logger — root for everything that doesn't carry request context. */
export const log = makeLogger({
    pid: process.pid,
    build_id: process.env.BUILD_ID ?? 'dev',
});

export default log;
