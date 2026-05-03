// @vitest-environment node
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {BundleService} from '@services/features/Bundle/BundleService';

const bundleServiceRef: {current?: BundleService} = {};
vi.mock('@services/infra/mongoDBConnection', () => ({
    getMongoConnection: () => ({
        get bundleService() { return bundleServiceRef.current; },
    }),
}));

// Bypass authn/origin/rate-limit — these are unit-tested elsewhere.
vi.mock('../../../pages/api/_authHelpers', () => ({
    requireRole: vi.fn(async () => ({ok: true, role: 'admin'})),
}));
vi.mock('../../../pages/api/_origin', () => ({
    requireSameOrigin: vi.fn(() => true),
}));
vi.mock('../../../pages/api/_rateLimit', () => ({
    rateLimit: vi.fn(() => ({ok: true})),
    clientIp: vi.fn(() => '127.0.0.1'),
}));

import exportHandler from '../../../pages/api/export';
import importHandler from '../../../pages/api/import';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`bundleapi_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    bundleServiceRef.current = new BundleService(db);
    // Seed a minimal site so export has shape to round-trip.
    await db.collection('Navigation').insertOne({type: 'navigation', id: 'n1', page: 'Home', sections: ['s1'], seo: {}});
    await db.collection('Sections').insertOne({id: 's1', type: 1, page: 'Home', content: [{type: 'TEXT', style: 'default', content: JSON.stringify({value: 'Hi'})}]});
    await db.collection('Languages').insertOne({label: 'English', symbol: 'en', flag: 'GB'});
    await db.collection('Logos').insertOne({id: 'logo-1', type: 'image', content: JSON.stringify({src: '', width: 40, height: 40})});
    await db.collection('Themes').insertOne({id: 't1', name: 'Classic', custom: false, tokens: {colorPrimary: '#3b3939'}});
    await db.collection('SiteSettings').insertOne({key: 'activeThemeId', value: 't1'});
});

const makeRes = () => {
    const res: any = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined as any,
        sent: undefined as any,
        status(code: number) { this.statusCode = code; return this; },
        json(payload: any) { this.body = payload; return this; },
        send(payload: any) { this.sent = payload; this.body = payload; return this; },
        setHeader(k: string, v: string) { this.headers[k] = v; },
    };
    return res;
};

const makeReq = (overrides: Partial<any> = {}) => ({
    method: 'GET',
    headers: {host: 'localhost:3000', origin: 'http://localhost:3000'},
    body: undefined,
    ...overrides,
}) as any;

describe('GET /api/export integration', () => {
    it('returns 200 with a bundle that has manifest + site', async () => {
        const res = makeRes();
        await exportHandler(makeReq(), res);
        expect(res.statusCode).toBe(200);
        expect(typeof res.sent).toBe('string');
        const bundle = JSON.parse(res.sent);
        expect(bundle.manifest).toBeTruthy();
        expect(bundle.manifest.version).toBe(1);
        expect(bundle.site).toBeTruthy();
        expect(bundle.site.navigation).toHaveLength(1);
        expect(bundle.site.activeThemeId).toBe('t1');
    });

    it('rejects non-GET with 405', async () => {
        const res = makeRes();
        await exportHandler(makeReq({method: 'POST'}), res);
        expect(res.statusCode).toBe(405);
    });
});

describe('export -> import -> export round-trip', () => {
    it('preserves the structural shape across a full round-trip', async () => {
        // 1. First export.
        const exp1 = makeRes();
        await exportHandler(makeReq(), exp1);
        const bundle1 = JSON.parse(exp1.sent);

        // 2. Wipe site collections then import the bundle back.
        for (const c of ['Navigation', 'Sections', 'Languages', 'Logos', 'Themes', 'Posts', 'Images', 'SiteSettings']) {
            await db.collection(c).deleteMany({});
        }
        const impRes = makeRes();
        await importHandler(makeReq({method: 'POST', body: bundle1}), impRes);
        expect(impRes.statusCode).toBe(200);
        expect(impRes.body?.ok).toBe(true);

        // 3. Re-export and compare structural shape (counts + keys),
        //    not exact timestamps which the manifest re-stamps each time.
        const exp2 = makeRes();
        await exportHandler(makeReq(), exp2);
        const bundle2 = JSON.parse(exp2.sent);

        expect(Object.keys(bundle2.site).sort()).toEqual(Object.keys(bundle1.site).sort());
        expect(bundle2.site.navigation.length).toBe(bundle1.site.navigation.length);
        expect(bundle2.site.sections.length).toBe(bundle1.site.sections.length);
        expect(bundle2.site.languages?.length).toBe(bundle1.site.languages?.length);
        expect(bundle2.site.themes?.length).toBe(bundle1.site.themes?.length);
        expect(bundle2.site.activeThemeId).toBe(bundle1.site.activeThemeId);
        expect(bundle2.manifest.version).toBe(bundle1.manifest.version);
    });

    it('rejects an obviously malformed bundle with 400', async () => {
        const res = makeRes();
        await importHandler(makeReq({method: 'POST', body: {nope: true}}), res);
        expect(res.statusCode).toBe(400);
    });
});
