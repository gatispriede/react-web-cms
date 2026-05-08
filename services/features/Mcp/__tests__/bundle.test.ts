/**
 * MCP `bundle.export` — progress-notification coverage (F8 wave-2).
 *
 * Verifies that when a `ctx.notify` callback is supplied, the tool
 * forwards monotonically-increasing progress ticks from the underlying
 * `BundleService.export(onProgress)` and that the absence of `notify`
 * is a clean no-op (token-less clients keep working).
 */
import {describe, expect, it, vi} from 'vitest';

let exportCalls = 0;

const fakeBundle = {
    manifest: {version: 1, exportedAt: '2026-05-08T00:00:00Z', app: 'redis-node-js-cloud'},
    site: {sections: []},
    assets: {},
};

const fakeConn = {
    bundleService: {
        export: vi.fn(async (onProgress?: (p: {progress: number; total: number; message: string}) => Promise<void>) => {
            exportCalls++;
            if (onProgress) {
                // 6-phase fake walk mirroring BundleService.export's tick layout.
                for (const i of [0, 1, 2, 3, 4, 6]) {
                    await onProgress({progress: i, total: 6, message: `phase ${i}`});
                }
            }
            return fakeBundle;
        }),
    },
};

vi.mock('@services/infra/mongoDBConnection', () => ({
    getMongoConnection: () => fakeConn,
}));

// fs.writeFile + stat — bundle.export writes the JSON to disk after the
// export resolves. Stub so the test doesn't touch the real FS.
vi.mock('node:fs/promises', async () => {
    const real = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    return {
        ...real,
        default: real,
        writeFile: vi.fn(async () => undefined),
        stat: vi.fn(async () => ({size: 1234} as any)),
    };
});

import {bundleExport} from '../tools/bundle';

const ACTOR = 'mcp:test';
const makeCtx = () => ({actor: ACTOR, audit: undefined, services: {}, token: null, tokenSecret: null} as any);
const decode = (r: any): any => JSON.parse(r.content[0].text);

describe('bundle.export — progress notifications (F8 wave-2)', () => {
    it('forwards ctx.notify with monotonic progress and matching total', async () => {
        const calls: Array<{progress: number; total?: number; message?: string}> = [];
        const ctx = {
            ...makeCtx(),
            notify: async (p: {progress: number; total?: number; message?: string}) => { calls.push(p); },
        };
        const r = decode(await bundleExport.handler({path: '/tmp/x.json'}, ctx));
        expect(r.ok).toBe(true);
        expect(calls.length).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < calls.length; i++) {
            expect(calls[i].progress).toBeGreaterThanOrEqual(calls[i - 1].progress);
            expect(calls[i].total).toBe(calls[0].total);
        }
        expect(calls[calls.length - 1].progress).toBe(calls[calls.length - 1].total);
    });

    it('runs cleanly with no notify callback (token-less client)', async () => {
        exportCalls = 0;
        const r = decode(await bundleExport.handler({path: '/tmp/x.json'}, makeCtx()));
        expect(r.ok).toBe(true);
        // The export ran; just no progress was forwarded.
        expect(exportCalls).toBeGreaterThan(0);
    });
});
