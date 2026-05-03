// @vitest-environment node
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
vi.mock('bcrypt');
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db, Collection} from 'mongodb';
import {UserService} from '@services/features/Users/UserService';

// Mock the singleton so the handler reaches our memory-backed service.
const userServiceRef: {current?: UserService} = {};
vi.mock('@services/infra/mongoDBConnection', () => ({
    getMongoConnection: () => ({
        get userService() { return userServiceRef.current; },
    }),
}));

// Pull in the handler AFTER the mock is registered.
import handler from '../../../pages/api/setup';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let users: Collection;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`setupapi_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    users = db.collection('Users');
    userServiceRef.current = new UserService(
        users,
        async () => {},
        'Admin',
        'admin-pass',
        '$2b$10$fakehashfakehashfakehashfakehashfakehashfakehashfakeha',
        4,
    );
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

describe('POST /api/setup integration', () => {
    it('seeds an admin and is idempotent across two calls', async () => {
        const res1 = makeRes();
        await handler(makeReq(), res1);
        expect(res1.statusCode).toBe(200);
        expect(res1.body?.ok).toBe(true);
        expect(res1.body?.admin?.id).toBeTruthy();
        const firstId = res1.body.admin.id;

        const res2 = makeRes();
        await handler(makeReq(), res2);
        expect(res2.statusCode).toBe(200);
        expect(res2.body?.admin?.id).toBe(firstId);

        const adminCount = await users.countDocuments({name: 'Admin'});
        expect(adminCount).toBe(1);
    });

    it('returns 405 for unsupported methods', async () => {
        const res = makeRes();
        await handler(makeReq({method: 'DELETE'}), res);
        expect(res.statusCode).toBe(405);
        expect(res.headers['Allow']).toContain('POST');
    });
});
