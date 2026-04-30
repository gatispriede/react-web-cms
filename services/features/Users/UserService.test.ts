import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
vi.mock('bcrypt');
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db, Collection} from 'mongodb';
import {UserService} from '@services/features/Users/UserService';

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

    // ---------- customer-auth surface ----------

    it('signUpCustomer creates a customer doc with role undefined', async () => {
        const res = JSON.parse(await service.signUpCustomer({user: {email: 'c@x.com', password: 'hunter2'} as any}));
        expect(res.createCustomer?.id).toBeDefined();
        const doc = await users.findOne({email: 'c@x.com'}) as any;
        expect(doc.kind).toBe('customer');
        expect(doc.role).toBeUndefined();
        expect(doc.canPublishProduction).toBeUndefined();
        expect(doc.password).not.toBe('hunter2');
    });

    it('signUpCustomer rejects an email already taken by an admin', async () => {
        await service.addUser({user: {email: 'shared@x.com', password: 'pw'} as any});
        const res = JSON.parse(await service.signUpCustomer({user: {email: 'shared@x.com', password: 'pw'} as any}));
        expect(res.error).toMatch(/already exists/);
    });

    it('signUpCustomer rejects an email already taken by another customer', async () => {
        await service.signUpCustomer({user: {email: 'c@x.com', password: 'pw'} as any});
        const res = JSON.parse(await service.signUpCustomer({user: {email: 'c@x.com', password: 'pw'} as any}));
        expect(res.error).toMatch(/already exists/);
    });

    it('addUser rejects emails taken by existing customers', async () => {
        await service.signUpCustomer({user: {email: 'shared@x.com', password: 'pw'} as any});
        const res = JSON.parse(await service.addUser({user: {email: 'shared@x.com', password: 'pw'} as any}));
        expect(res.error).toMatch(/already exists/);
    });

    it('getUsers filters out customers', async () => {
        await service.addUser({user: {email: 'admin@x.com', password: 'pw'} as any});
        await service.signUpCustomer({user: {email: 'cust@x.com', password: 'pw'} as any});
        const list = await service.getUsers();
        const emails = list.map(u => u.email);
        expect(emails).toContain('admin@x.com');
        expect(emails).not.toContain('cust@x.com');
    });

    it('getMe returns the customer doc with password redacted', async () => {
        await service.signUpCustomer({user: {email: 'me@x.com', password: 'pw', name: 'Me'} as any});
        const me = await service.getMe({_session: {email: 'me@x.com'}});
        expect(me?.email).toBe('me@x.com');
        expect(me?.password).toBe('');
        expect(me?.kind).toBe('customer');
    });

    it('getMe ignores admin docs', async () => {
        await service.addUser({user: {email: 'admin@x.com', password: 'pw'} as any});
        const me = await service.getMe({_session: {email: 'admin@x.com'}});
        expect(me).toBeUndefined();
    });

    it('updateMyProfile cannot escalate role / kind / canPublishProduction', async () => {
        await service.signUpCustomer({user: {email: 'me@x.com', password: 'pw'} as any});
        const res = JSON.parse(await service.updateMyProfile({
            user: {email: 'me@x.com', name: 'New', role: 'admin', kind: 'admin', canPublishProduction: true} as any,
            _session: {email: 'me@x.com'},
        }));
        expect(res.error).toBeUndefined();
        const doc = await users.findOne({email: 'me@x.com'}) as any;
        expect(doc.role).toBeUndefined();
        expect(doc.kind).toBe('customer');
        expect(doc.canPublishProduction).toBeUndefined();
        expect(doc.name).toBe('New');
    });

    it('changeMyPassword requires the correct old password', async () => {
        await service.signUpCustomer({user: {email: 'me@x.com', password: 'old-pw'} as any});
        const wrong = JSON.parse(await service.changeMyPassword({
            oldPassword: 'wrong', newPassword: 'new-pw', _session: {email: 'me@x.com'},
        }));
        expect(wrong.error).toMatch(/old password/);
        const ok = JSON.parse(await service.changeMyPassword({
            oldPassword: 'old-pw', newPassword: 'new-pw', _session: {email: 'me@x.com'},
        }));
        expect(ok.changeMyPassword?.id).toBeDefined();
    });

    it('saveMyAddress creates and updates entries scoped by session', async () => {
        await service.signUpCustomer({user: {email: 'me@x.com', password: 'pw'} as any});
        const created = JSON.parse(await service.saveMyAddress({
            address: {name: 'home', line1: '1 Main', city: 'NY', postalCode: '10001', country: 'US', isDefault: true} as any,
            _session: {email: 'me@x.com'},
        }));
        expect(created.saveMyAddress?.id).toBeDefined();
        const doc = await users.findOne({email: 'me@x.com'}) as any;
        expect(doc.shippingAddresses).toHaveLength(1);
        expect(doc.shippingAddresses[0].isDefault).toBe(true);

        // IDOR guard — passing some other customer's address id must be
        // rejected (not silently created under this customer's array).
        const idor = JSON.parse(await service.saveMyAddress({
            address: {id: 'addr-from-mars', name: 'x', line1: 'x', city: 'x', postalCode: 'x', country: 'x'} as any,
            _session: {email: 'me@x.com'},
        }));
        expect(idor.error).toMatch(/not found/);
    });

    it('addCustomerFromGoogle is idempotent on googleSub and links by email', async () => {
        await service.signUpCustomer({user: {email: 'g@x.com', password: 'pw'} as any});
        // First touch — link existing customer by email
        const linked = JSON.parse(await service.addCustomerFromGoogle({email: 'g@x.com', googleSub: 'sub-123'}));
        expect(linked.createCustomer?.linked).toBe(true);

        // Second touch with same googleSub — idempotent (no new doc, same id)
        const again = JSON.parse(await service.addCustomerFromGoogle({email: 'g@x.com', googleSub: 'sub-123'}));
        expect(again.createCustomer?.id).toBe(linked.createCustomer.id);
        const count = await users.countDocuments({email: 'g@x.com'});
        expect(count).toBe(1);

        // Brand new customer via Google
        const fresh = JSON.parse(await service.addCustomerFromGoogle({email: 'newg@x.com', googleSub: 'sub-456', name: 'New G'}));
        expect(fresh.createCustomer?.id).toBeDefined();
        expect(fresh.createCustomer?.linked).toBe(false);
    });

    it('addCustomerFromGoogle refuses to convert an existing admin into a customer', async () => {
        await service.addUser({user: {email: 'admin@x.com', password: 'pw'} as any});
        const res = JSON.parse(await service.addCustomerFromGoogle({email: 'admin@x.com', googleSub: 'sub'}));
        expect(res.error).toMatch(/already in use/);
    });

    it('setupAdmin back-fills kind on legacy docs', async () => {
        await users.insertOne({id: 'legacy', name: 'Admin', email: 'a@x.com', password: 'x'} as any);
        const res = await service.setupAdmin();
        expect(res?.kind).toBe('admin');
        const doc = await users.findOne({id: 'legacy'}) as any;
        expect(doc.kind).toBe('admin');
        expect(doc.role).toBe('admin');
    });
});
