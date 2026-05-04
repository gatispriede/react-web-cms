/**
 * F8 Week-1 hardening primitives — shared wrappers every MCP tool
 * (will, in phase 2) compose with.
 *
 * Composition order, outermost → innermost:
 *
 *     rate-limit  ──▶  idempotency  ──▶  audit  ──▶  error-envelope  ──▶  handler
 *
 * Why this order:
 *   - **rate-limit outermost** — cheap reject; we don't want to consume
 *     idempotency-cache slots or audit rows for traffic we're rejecting.
 *   - **idempotency next** — replays should short-circuit before the
 *     audit hook fires (so we don't double-log a single user intent),
 *     but after the rate-limit (so a flooding client can't bypass the
 *     window by reusing one key).
 *   - **audit inside idempotency** — only real executions get audited;
 *     replays return the cached envelope.
 *   - **error-envelope innermost** — the handler's raw throws map to
 *     `{ok: false, error: …}` shapes; everything outside speaks the
 *     same envelope dialect.
 *
 * Every wrapper is independently usable; `compose(handler, opts)` chains
 * them in the canonical order. Phase-2 sweep will swap the existing 38
 * handlers onto `compose(...)`; this module ships behind a feature
 * boundary so that sweep is a mechanical rename.
 */

import {getIdempotencyService} from '@services/infra/idempotency';
import {rateLimit as slidingWindowRateLimit} from '@client/pages/api/_rateLimit';
import {FeatureRestrictedError} from '../modeEnforcement';
import {McpError, McpTool, McpToolContext, McpToolResult} from '../types';

// `args` is intentionally `any` — the dispatcher validates against
// `inputSchema` before calling, but the in-handler property reads are
// loose (mirrors the existing `McpTool.handler` signature which also
// accepts `any`). Tightening here would force every handler to add
// runtime casts for already-validated fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawHandler<T = unknown> = (args: any, ctx: McpToolContext) => Promise<T>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolHandler = (args: any, ctx: McpToolContext) => Promise<McpToolResult>;

export type ErrorCode =
    | 'RATE_LIMITED'
    | 'IDEMPOTENCY_CONFLICT'
    | 'MODE_RESTRICTED'
    | 'INVALID_ARGS'
    | 'INTERNAL';

export interface ErrorEnvelope {
    ok: false;
    error: {
        code: ErrorCode | string;
        message: string;
        hint?: string;
        retryAfterMs?: number;
    };
}

export interface OkEnvelope<T> {
    ok: true;
    data: T;
}

export type Envelope<T> = OkEnvelope<T> | ErrorEnvelope;

export class RateLimitError extends Error {
    public readonly code = 'RATE_LIMITED' as const;
    constructor(public retryAfterMs: number, message?: string) {
        super(message ?? `Rate limit exceeded; retry in ${retryAfterMs}ms`);
        this.name = 'RateLimitError';
    }
}

export class IdempotencyConflictError extends Error {
    public readonly code = 'IDEMPOTENCY_CONFLICT' as const;
    constructor(message = 'Idempotency key in use with a different payload') {
        super(message);
        this.name = 'IdempotencyConflictError';
    }
}

const SECRET_KEY_RE = /password|secret|token|key|authorization|bearer/i;
const REDACTED = '[REDACTED]';

/**
 * Best-effort recursive redaction. Field NAMES matching `password|secret
 * |token|key` (case-insensitive) get replaced with `[REDACTED]`. Values
 * are not pattern-matched — agents shouldn't be passing creds, but the
 * defence is in depth.
 */
export function redactSensitive(value: unknown, depth = 0): unknown {
    if (depth > 6) return '[depth]';
    if (Array.isArray(value)) return value.map(v => redactSensitive(v, depth + 1));
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (SECRET_KEY_RE.test(k)) out[k] = REDACTED;
            else out[k] = redactSensitive(v, depth + 1);
        }
        return out;
    }
    return value;
}

function deriveScope(toolName: string): string {
    const dot = toolName.indexOf('.');
    return dot > 0 ? toolName.slice(0, dot) : toolName;
}

// ──────────────────────────────────────────────────────────────────────
// Wrapper 1 — Idempotency
// ──────────────────────────────────────────────────────────────────────

export interface WithIdempotencyOpts {
    toolName: string;
    /** When false (or omitted), the key is ignored and the handler runs every time. */
    enabled?: boolean;
}

export function withIdempotency<T>(
    handler: RawHandler<T>,
    opts: WithIdempotencyOpts,
): RawHandler<T> {
    return async (args, ctx) => {
        const key = typeof args.idempotencyKey === 'string' ? args.idempotencyKey : null;
        if (!opts.enabled || !key) return handler(args, ctx);
        const svc = getIdempotencyService();
        return svc.checkOrRun<T>(`mcp:${opts.toolName}:${key}`, () => handler(args, ctx));
    };
}

// ──────────────────────────────────────────────────────────────────────
// Wrapper 2 — Audit
// ──────────────────────────────────────────────────────────────────────

export interface WithAuditOpts {
    toolName: string;
    auditScope?: string;
}

export function withAudit<T>(
    handler: RawHandler<T>,
    opts: WithAuditOpts,
): RawHandler<T> {
    const scope = opts.auditScope ?? deriveScope(opts.toolName);
    return async (args, ctx) => {
        let result: T | undefined;
        let thrown: unknown;
        try {
            result = await handler(args, ctx);
            return result;
        } catch (err) {
            thrown = err;
            throw err;
        } finally {
            if (ctx.audit) {
                try {
                    await ctx.audit.record({
                        collection: 'McpToolCall',
                        op: 'create',
                        actor: {email: ctx.actor, role: 'admin'},
                        diff: {
                            before: null,
                            after: {
                                tool: opts.toolName,
                                scope,
                                args: redactSensitive(args),
                                ok: thrown === undefined,
                                error: thrown ? String((thrown as Error).message ?? thrown) : undefined,
                            },
                        },
                        tag: thrown
                            ? `mcp:${opts.toolName}:err`
                            : `mcp:${opts.toolName}:ok`,
                    });
                } catch {
                    // audit failures never block — the AuditService logs
                    // them itself; we deliberately swallow here.
                }
            }
        }
    };
}

// ──────────────────────────────────────────────────────────────────────
// Wrapper 3 — Rate limit
// ──────────────────────────────────────────────────────────────────────

const ONE_MINUTE_MS = 60_000;

export interface WithRateLimitOpts {
    toolName: string;
    maxPerMinute: number;
}

export function withRateLimit<T>(
    handler: RawHandler<T>,
    opts: WithRateLimitOpts,
): RawHandler<T> {
    return async (args, ctx) => {
        const bucketKey = `mcp:${opts.toolName}:${ctx.actor}`;
        const decision = slidingWindowRateLimit(bucketKey, opts.maxPerMinute, ONE_MINUTE_MS);
        if (!decision.ok) {
            throw new RateLimitError(decision.retryAfterMs);
        }
        return handler(args, ctx);
    };
}

// ──────────────────────────────────────────────────────────────────────
// Wrapper 4 — Error envelope
// ──────────────────────────────────────────────────────────────────────

export interface WithErrorEnvelopeOpts {
    toolName: string;
    /** Optional logger for unknown errors. Defaults to `console.error`. */
    logUnknown?: (err: unknown, toolName: string) => void;
}

const DEFAULT_LOG_UNKNOWN = (err: unknown, toolName: string): void => {
    // eslint-disable-next-line no-console
    console.error(`[mcp:${toolName}] unhandled`, err);
};

export function withErrorEnvelope<T>(
    handler: RawHandler<T>,
    opts: WithErrorEnvelopeOpts,
): RawHandler<Envelope<T>> {
    return async (args, ctx) => {
        try {
            const data = await handler(args, ctx);
            return {ok: true, data};
        } catch (err) {
            return {ok: false, error: mapError(err, opts)};
        }
    };
}

function mapError(err: unknown, opts: WithErrorEnvelopeOpts): ErrorEnvelope['error'] {
    if (err instanceof RateLimitError) {
        return {
            code: 'RATE_LIMITED',
            message: err.message,
            retryAfterMs: err.retryAfterMs,
            hint: 'Back off and retry after the indicated delay.',
        };
    }
    if (err instanceof IdempotencyConflictError) {
        return {code: 'IDEMPOTENCY_CONFLICT', message: err.message};
    }
    if (err instanceof FeatureRestrictedError) {
        return {
            code: 'MODE_RESTRICTED',
            message: err.message,
            hint: 'This tool requires advanced admin UI mode.',
        };
    }
    if (err instanceof McpError) {
        return {code: err.code || 'INTERNAL', message: err.message};
    }
    (opts.logUnknown ?? DEFAULT_LOG_UNKNOWN)(err, opts.toolName);
    return {
        code: 'INTERNAL',
        message: (err as Error)?.message ?? String(err),
    };
}

// ──────────────────────────────────────────────────────────────────────
// compose — the canonical ordering
// ──────────────────────────────────────────────────────────────────────

export interface ComposeOpts {
    tool: Pick<McpTool, 'name' | 'idempotent' | 'auditScope' | 'rateLimit' | 'scopes'>;
    /**
     * Override the default rate limit. When omitted, derives from
     * `tool.rateLimit?.maxPerMinute`, or 30 for write-scoped tools, or
     * 100 for read-only tools.
     */
    maxPerMinute?: number;
    logUnknown?: (err: unknown, toolName: string) => void;
}

export function defaultRateLimit(tool: ComposeOpts['tool']): number {
    if (tool.rateLimit?.maxPerMinute) return tool.rateLimit.maxPerMinute;
    const isWrite = tool.scopes.some(s => /^write:/.test(s));
    return isWrite ? 30 : 100;
}

/**
 * Convenience builder — declare an `McpTool` whose handler is wrapped by
 * `compose(...)` automatically. Lets call sites avoid the awkward
 * "spread metadata twice" pattern. The raw handler returns the inner
 * data; the wrapper turns it into the MCP envelope shape.
 */
export function defineTool<T = unknown>(
    meta: Omit<McpTool, 'handler'>,
    raw: RawHandler<T>,
    extra?: {logUnknown?: ComposeOpts['logUnknown']},
): McpTool {
    return {
        ...meta,
        handler: compose<T>(raw, {tool: meta, logUnknown: extra?.logUnknown}),
    };
}

/**
 * Wrap a raw handler with all four primitives in the documented order.
 * The returned function still produces a `McpToolResult`; the envelope
 * is JSON-serialised into `result.content[0].text` so existing
 * dispatchers don't change shape.
 */
export function compose<T = unknown>(
    handler: RawHandler<T>,
    opts: ComposeOpts,
): ToolHandler {
    const toolName = opts.tool.name;
    const maxPerMinute = opts.maxPerMinute ?? defaultRateLimit(opts.tool);
    // Build innermost-out: handler → idempotency → rate-limit, then wrap
    // the whole thing in error-envelope so RateLimitError emitted by the
    // outermost wrapper still maps to the envelope.
    //
    // NOTE: `withAudit` is exported separately and exercised in tests,
    // but is NOT inserted here — `McpServer.dispatch` already records a
    // single audit row per call (with redaction) at the dispatcher
    // level, so adding withAudit here would double-log every tool call.
    const idempotent = withIdempotency(handler, {
        toolName,
        enabled: opts.tool.idempotent === true,
    });
    const limited = withRateLimit(idempotent, {toolName, maxPerMinute});
    const enveloped = withErrorEnvelope(limited, {
        toolName,
        logUnknown: opts.logUnknown,
    });
    return async (args, ctx) => {
        const env = await enveloped(args, ctx);
        return {content: [{type: 'text' as const, text: JSON.stringify(env)}]};
    };
}
