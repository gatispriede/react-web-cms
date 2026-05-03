// @vitest-environment node
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db, Collection} from 'mongodb';
import {AssetService} from '@services/features/Assets/AssetService';

const assetServiceRef: {current?: AssetService} = {};
vi.mock('@services/infra/mongoDBConnection', () => ({
    getMongoConnection: () => ({
        get assetService() { return assetServiceRef.current; },
    }),
}));
vi.mock('../../../pages/api/_authHelpers', () => ({
    requireRole: vi.fn(async () => ({ok: true, role: 'admin'})),
}));
vi.mock('../../../pages/api/_origin', () => ({
    requireSameOrigin: vi.fn(() => true),
}));

import handler from '../../../pages/api/rescan-images';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let images: Collection;
let logos: Collection;

// AssetService.rescanDiskImages reads from process.cwd()/ui/client/public/images.
const IMAGES_DIR = path.join(process.cwd(), 'ui/client/public/images');
const FIXTURE_NAME = `__rescan_test_${Date.now()}_${Math.floor(Math.random() * 1e9)}.png`;
const FIXTURE_PATH = path.join(IMAGES_DIR, FIXTURE_NAME);
// 1x1 transparent PNG.
const PNG_1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    'base64',
);

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    fs.mkdirSync(IMAGES_DIR, {recursive: true});
    fs.writeFileSync(FIXTURE_PATH, PNG_1x1);
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
    try { fs.unlinkSync(FIXTURE_PATH); } catch { /* ignore */ }
});

beforeEach(() => {
    db = client.db(`rescanapi_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    logos = db.collection('Logos');
    images = db.collection('Images');
    assetServiceRef.current = new AssetService(logos, images, async () => {});
});

afterEach(async () => {
    await db.dropDatabase().catch(() => {});
});

const makeRes = () => {
    const res: any = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined as any,
        status(code: number) { this.statusCode = code; return this; },
        json(payload: any) { this.body = payload; return this; },
        send(payload: any) { this.body = payload; return this; },
        setHeader(k: string, v: string) { this.headers[k] = v; },
    };
    return res;
};

const makeReq = (overrides: Partial<any> = {}) => ({
    method: 'POST',
    headers: {host: 'localhost:3000', origin: 'http://localhost:3000'},
    body: undefined,
    ...overrides,
}) as any;

describe('POST /api/rescan-images integration', () => {
    it('inserts a record for an on-disk image missing from the Images collection', async () => {
        // Sanity: the fixture file is on disk; the DB has no row for it yet.
        const beforeCount = await images.countDocuments({name: FIXTURE_NAME});
        expect(beforeCount).toBe(0);

        const res = makeRes();
        await handler(makeReq(), res);
        expect(res.statusCode).toBe(200);
        expect(res.body?.ok).toBe(true);
        // `added` must be ≥ 1 since the fixture file was missing.
        expect(res.body?.added).toBeGreaterThanOrEqual(1);

        const afterCount = await images.countDocuments({name: FIXTURE_NAME});
        expect(afterCount).toBe(1);
    });

    it('is idempotent — a second rescan adds no new records', async () => {
        const res1 = makeRes();
        await handler(makeReq(), res1);
        const totalAfterFirst = await images.countDocuments({});

        const res2 = makeRes();
        await handler(makeReq(), res2);
        expect(res2.statusCode).toBe(200);
        expect(res2.body?.added).toBe(0);

        const totalAfterSecond = await images.countDocuments({});
        expect(totalAfterSecond).toBe(totalAfterFirst);
    });

    it('rejects non-POST with 405', async () => {
        const res = makeRes();
        await handler(makeReq({method: 'GET'}), res);
        expect(res.statusCode).toBe(405);
    });
});
