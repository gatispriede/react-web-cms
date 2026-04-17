import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db, Collection} from 'mongodb';
import {UserService} from './UserService';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let users: Collection;
let service: UserService;

const makeService = () =>
    new UserService(users, async () => {}, 'Admin', 'admin-pass', '$2b$10$fakehash', 4);

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db('test');
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    users = db.collection(`users_${Date.now()}_${Math.random()}`);
    service = makeService();
});

describe('UserService', () => {
    it('setupAdmin creates the admin doc on first call and is idempotent', async () => {
        const first = await service.setupAdmin();
        expect(first).toBeDefined();
        expect(first?.role).toBe('admin');

        const second = await service.setupAdmin();
        expect(second?.id).toBe(first?.id);

        const count = await users.countDocuments({name: 'Admin'});
        expect(count).toBe(1);
    });

    it('addUser hashes the password and rejects duplicates', async () => {
        const res = await service.addUser({user: {email: 'a@b.com', password: 'hunter2'} as any});
        expect(JSON.parse(res).createUser?.id).toBeDefined();

        const doc = await users.findOne({email: 'a@b.com'}) as any;
        expect(doc.password).not.toBe('hunter2');
        expect(doc.password).toMatch(/^\$2[aby]\$/);

        const dup = await service.addUser({user: {email: 'a@b.com', password: 'x'} as any});
        expect(JSON.parse(dup).error).toMatch(/already exists/);
    });

    it('updateUser toggles canPublishProduction', async () => {
        const created = JSON.parse(await service.addUser({user: {email: 'b@c.com', password: 'pw'} as any}));
        const id = created.createUser.id;

        await service.updateUser({user: {id, email: 'b@c.com', canPublishProduction: true} as any});
        const updated = await users.findOne({id}) as any;
        expect(updated.canPublishProduction).toBe(true);
    });

    it('removeUser blocks removing the last admin', async () => {
        await service.setupAdmin();
        const admin = await users.findOne({role: 'admin'}) as any;
        const result = JSON.parse(await service.removeUser({id: admin.id}));
        expect(result.error).toMatch(/last admin/);
    });

    it('getUsers returns all users without exposing password', async () => {
        await service.addUser({user: {email: 'x@y.com', password: 'pw'} as any});
        const list = await service.getUsers();
        expect(list.length).toBeGreaterThan(0);
        expect(list[0].password).toBe('');
    });
});
