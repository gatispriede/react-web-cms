import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
    compose,
    redactSensitive,
    withAudit,
    withErrorEnvelope,
    withIdempotency,
    withRateLimit,
    RateLimitError,
    IdempotencyConflictError,
    type Envelope,
} from './_shared';
import {_resetIdempotencyForTests} from '@services/infra/idempotency';
import {FeatureRestrictedError} from '../modeEnforcement';
import {McpError, type McpToolContext} from '../types';

const ctx = (overrides: Partial<McpToolContext> = {}): McpToolContext => ({
    services: {},
    actor: 'mcp:test-token',
    audit: undefined,
    ...overrides,
});

beforeEach(() => {
    _resetIdempotencyForTests();
});

describe('redactSensitive', () => {
    it('redacts password / apiKey / secret_token by name (case-insensitive, recursive)', () => {
        const out = redactSensitive({
            password: 'hunter2',
            apiKey: 'abc',
            nested: {secret_token: 'ssss', other: 'keep'},
            list: [{Token: 'x'}],
            normal: 1,
        }) as any;
        expect(out.password).toBe('[REDACTED]');
        expect(out.apiKey).toBe('[REDACTED]');
        expect(out.nested.secret_token).toBe('[REDACTED]');
        expect(out.nested.other).toBe('keep');
        expect(out.list[0].Token).toBe('[REDACTED]');
        expect(out.normal).toBe(1);
    });
});

describe('withIdempotency', () => {
    it('runs the handler once for the same key, replaying the cached result', async () => {
        let n = 0;
        const wrapped = withIdempotency<number>(async () => ++n, {
            toolName: 'test.op',
            enabled: true,
        });
        const a = await wrapped({idempotencyKey: 'k1'} as any, ctx());
        const b = await wrapped({idempotencyKey: 'k1'} as any, ctx());
        expect(a).toBe(1);
        expect(b).toBe(1);
        expect(n).toBe(1);
    });

    it('passes through (re-runs) when no idempotencyKey', async () => {
        let n = 0;
        const wrapped = withIdempotency<number>(async () => ++n, {
            toolName: 'test.op',
            enabled: true,
        });
        await wrapped({} as any, ctx());
        await wrapped({} as any, ctx());
        expect(n).toBe(2);
    });

    it('passes through when not enabled, even with a key', async () => {
        let n = 0;
        const wrapped = withIdempotency<number>(async () => ++n, {
            toolName: 'test.op',
            enabled: false,
        });
        await wrapped({idempotencyKey: 'k1'} as any, ctx());
        await wrapped({idempotencyKey: 'k1'} as any, ctx());
        expect(n).toBe(2);
    });
});

describe('withAudit', () => {
    it('writes one audit row with redacted args on success', async () => {
        const record = vi.fn(async () => undefined);
        const audit = {record} as any;
        const wrapped = withAudit<{x: number}>(
            async () => ({x: 1}),
            {toolName: 'page.delete'},
        );
        const out = await wrapped({password: 'secret', id: 'p1'} as any, ctx({audit}));
        expect(out).toEqual({x: 1});
        expect(record).toHaveBeenCalledTimes(1);
        const entry = record.mock.calls[0][0];
        expect(entry.tag).toBe('mcp:page.delete:ok');
        expect(entry.diff.after.scope).toBe('page');
        expect(entry.diff.after.args.password).toBe('[REDACTED]');
        expect(entry.diff.after.args.id).toBe('p1');
        expect(entry.diff.after.ok).toBe(true);
    });

    it('still audits on failure (with err tag)', async () => {
        const record = vi.fn(async () => undefined);
        const audit = {record} as any;
        const wrapped = withAudit(
            async () => { throw new Error('boom'); },
            {toolName: 'page.delete'},
        );
        await expect(wrapped({} as any, ctx({audit}))).rejects.toThrow('boom');
        expect(record).toHaveBeenCalledTimes(1);
        expect(record.mock.calls[0][0].tag).toBe('mcp:page.delete:err');
    });
});

describe('withRateLimit', () => {
    it('throws RateLimitError when over the per-minute cap', async () => {
        const wrapped = withRateLimit<number>(async () => 1, {
            toolName: `rl.test.${Math.random()}`,
            maxPerMinute: 30,
        });
        for (let i = 0; i < 30; i++) {
            await expect(wrapped({} as any, ctx())).resolves.toBe(1);
        }
        await expect(wrapped({} as any, ctx())).rejects.toBeInstanceOf(RateLimitError);
    });

    it('routes via withErrorEnvelope into a RATE_LIMITED envelope', async () => {
        const tool = {name: `rl.env.${Math.random()}`} as const;
        const handler = withRateLimit<number>(async () => 1, {
            toolName: tool.name,
            maxPerMinute: 30,
        });
        const wrapped = withErrorEnvelope<number>(handler, {toolName: tool.name});
        for (let i = 0; i < 30; i++) {
            await wrapped({} as any, ctx());
        }
        const env = await wrapped({} as any, ctx());
        expect(env.ok).toBe(false);
        if (!env.ok) {
            expect(env.error.code).toBe('RATE_LIMITED');
            expect(env.error.retryAfterMs).toBeGreaterThan(0);
        }
    });
});

describe('withErrorEnvelope', () => {
    it('maps known errors to known codes', async () => {
        const make = (err: Error) => withErrorEnvelope(
            async () => { throw err; },
            {toolName: 'x.y', logUnknown: () => {}},
        );
        const r1 = await make(new RateLimitError(123))({} as any, ctx());
        const r2 = await make(new IdempotencyConflictError())({} as any, ctx());
        const r3 = await make(new FeatureRestrictedError('nope'))({} as any, ctx());
        const r4 = await make(new McpError('CUSTOM', 'msg'))({} as any, ctx());
        const r5 = await make(new Error('weird'))({} as any, ctx());
        expect((r1 as any).error.code).toBe('RATE_LIMITED');
        expect((r2 as any).error.code).toBe('IDEMPOTENCY_CONFLICT');
        expect((r3 as any).error.code).toBe('MODE_RESTRICTED');
        expect((r4 as any).error.code).toBe('CUSTOM');
        expect((r5 as any).error.code).toBe('INTERNAL');
    });

    it('logs unknown errors via the supplied logger', async () => {
        const log = vi.fn();
        const wrapped = withErrorEnvelope(
            async () => { throw new Error('mystery'); },
            {toolName: 't', logUnknown: log},
        );
        await wrapped({} as any, ctx());
        expect(log).toHaveBeenCalledTimes(1);
        expect(log.mock.calls[0][1]).toBe('t');
    });

    it('wraps successful results in {ok: true, data}', async () => {
        const wrapped = withErrorEnvelope<{n: number}>(
            async () => ({n: 7}),
            {toolName: 't'},
        );
        const env = await wrapped({} as any, ctx());
        expect(env).toEqual({ok: true, data: {n: 7}});
    });
});

describe('compose', () => {
    it('returns a handler that produces an MCP envelope inside content[0].text', async () => {
        const tool = {
            name: `cmp.ok.${Math.random()}`,
            scopes: ['read:content'] as const,
            idempotent: false,
        };
        const handler = compose<{n: number}>(async () => ({n: 1}), {
            tool: tool as any,
            maxPerMinute: 100,
        });
        const out = await handler({} as any, ctx());
        const payload = JSON.parse(out.content[0].text) as Envelope<{n: number}>;
        expect(payload).toEqual({ok: true, data: {n: 1}});
    });

    it('rate-limit is outermost — exhausting the bucket short-circuits before the handler runs', async () => {
        let calls = 0;
        const tool = {
            name: `cmp.rl.${Math.random()}`,
            scopes: ['write:content'] as const,
            idempotent: false,
            rateLimit: {maxPerMinute: 2},
        };
        const handler = compose<number>(async () => { calls++; return 1; }, {tool: tool as any});
        await handler({} as any, ctx());
        await handler({} as any, ctx());
        const blocked = await handler({} as any, ctx());
        const env = JSON.parse(blocked.content[0].text);
        expect(env.ok).toBe(false);
        expect(env.error.code).toBe('RATE_LIMITED');
        expect(calls).toBe(2);
    });

    it('idempotency replays do not re-audit', async () => {
        const record = vi.fn(async () => undefined);
        const audit = {record} as any;
        const tool = {
            name: `cmp.idem.${Math.random()}`,
            scopes: ['write:content'] as const,
            idempotent: true,
            rateLimit: {maxPerMinute: 100},
        };
        let n = 0;
        const handler = compose<number>(async () => ++n, {tool: tool as any});
        await handler({idempotencyKey: 'k'} as any, ctx({audit}));
        await handler({idempotencyKey: 'k'} as any, ctx({audit}));
        expect(n).toBe(1);
        // Audit fires inside the idempotency boundary, so the replay
        // should NOT produce a second record.
        expect(record).toHaveBeenCalledTimes(1);
    });
});
