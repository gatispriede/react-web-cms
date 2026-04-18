import {describe, it, expect, vi} from 'vitest';
import {requireSameOrigin} from './_origin';

const makeRes = () => {
    const res: any = {
        statusCode: 0,
        status(code: number) { this.statusCode = code; return this; },
        json: vi.fn(function (this: any, body: any) { this.body = body; return this; }),
    };
    return res;
};

describe('requireSameOrigin', () => {
    it('allows a same-origin request with a matching Origin header', () => {
        const res = makeRes();
        const ok = requireSameOrigin(
            {headers: {host: 'example.com', origin: 'https://example.com'}} as any,
            res,
        );
        expect(ok).toBe(true);
        expect(res.json).not.toHaveBeenCalled();
    });

    it('falls back to Referer when Origin is absent', () => {
        const res = makeRes();
        const ok = requireSameOrigin(
            {headers: {host: 'example.com', referer: 'https://example.com/somewhere'}} as any,
            res,
        );
        expect(ok).toBe(true);
    });

    it('rejects a cross-origin Origin with 403', () => {
        const res = makeRes();
        const ok = requireSameOrigin(
            {headers: {host: 'example.com', origin: 'https://evil.io'}} as any,
            res,
        );
        expect(ok).toBe(false);
        expect(res.statusCode).toBe(403);
    });

    it('rejects when both Origin and Referer are missing', () => {
        const res = makeRes();
        const ok = requireSameOrigin(
            {headers: {host: 'example.com'}} as any,
            res,
        );
        expect(ok).toBe(false);
        expect(res.statusCode).toBe(403);
    });

    it('rejects requests missing a Host header (400)', () => {
        const res = makeRes();
        const ok = requireSameOrigin({headers: {}} as any, res);
        expect(ok).toBe(false);
        expect(res.statusCode).toBe(400);
    });
});
