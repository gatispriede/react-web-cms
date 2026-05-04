import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

const makeRes = () => {
    const res: any = {
        statusCode: 0,
        headers: {} as Record<string, string>,
        body: undefined as any,
        setHeader(name: string, value: string) { this.headers[name] = value; },
        status(code: number) { this.statusCode = code; return this; },
        json: vi.fn(function (this: any, body: any) { this.body = body; return this; }),
    };
    return res;
};

describe('GET /api/info', () => {
    let prevSha: string | undefined;
    let prevTs: string | undefined;

    beforeEach(() => {
        prevSha = process.env.GIT_SHA;
        prevTs = process.env.BUILD_TS;
        process.env.GIT_SHA = 'abc1234deadbeef';
        process.env.BUILD_TS = '2026-05-03T12:00:00Z';
    });

    afterEach(() => {
        if (prevSha === undefined) delete process.env.GIT_SHA;
        else process.env.GIT_SHA = prevSha;
        if (prevTs === undefined) delete process.env.BUILD_TS;
        else process.env.BUILD_TS = prevTs;
    });

    it('returns exactly {version, bootId, buildTimestamp} — no extra keys', async () => {
        const {default: handler} = await import('../../../pages/api/info');
        const res = makeRes();
        handler({} as any, res);
        expect(res.statusCode).toBe(200);
        expect(Object.keys(res.body).sort()).toEqual(['bootId', 'buildTimestamp', 'version']);
        expect(res.body.version).toBe('abc1234deadbeef');
        expect(res.body.buildTimestamp).toBe('2026-05-03T12:00:00Z');
        expect(typeof res.body.bootId).toBe('string');
        expect(res.body.bootId.length).toBeGreaterThan(0);
    });

    it('falls back to "unknown" / null when env not stamped', async () => {
        delete process.env.GIT_SHA;
        delete process.env.BUILD_TS;
        const {default: handler} = await import('../../../pages/api/info');
        const res = makeRes();
        handler({} as any, res);
        expect(res.body.version).toBe('unknown');
        expect(res.body.buildTimestamp).toBeNull();
    });

    it('sets Cache-Control: no-store', async () => {
        const {default: handler} = await import('../../../pages/api/info');
        const res = makeRes();
        handler({} as any, res);
        expect(res.headers['Cache-Control']).toBe('no-store');
    });

    it('does NOT leak any other env vars', async () => {
        process.env.MONGO_URI = 'mongodb://x:hunter2@y/z';
        process.env.SOMETHING_SECRET = 'hunter2';
        const {default: handler} = await import('../../../pages/api/info');
        const res = makeRes();
        handler({} as any, res);
        const json = JSON.stringify(res.body);
        expect(json).not.toContain('hunter2');
        expect(json).not.toContain('MONGO_URI');
        expect(json).not.toContain('SECRET');
    });
});
