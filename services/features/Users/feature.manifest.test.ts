import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {usersFeature, _resetAdminSeededForTest} from '@services/features/Users/feature.manifest';
import {UserService} from '@services/features/Users/UserService';

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

beforeEach(() => {
    db = client.db(`users_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    _resetAdminSeededForTest();
});

describe('usersFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(usersFeature.id).toBe('users');
        expect(usersFeature.displayName).toBe('Users');
    });

    it('does not declare requires', () => {
        expect(usersFeature.requires).toBeUndefined();
    });

    it('services factory returns a `users` key holding a UserService', () => {
        const built = usersFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['users']);
        expect(built?.users).toBeInstanceOf(UserService);
    });

    it('onBoot seeds an admin user and is idempotent across reboots', async () => {
        const prevPwd = process.env.ADMIN_DEFAULT_PASSWORD;
        process.env.ADMIN_DEFAULT_PASSWORD = 'test-seed-password';
        try {
            const built = usersFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}}) ?? {};
            await usersFeature.onBoot?.({db, redis: {} as any, services: built, reconnect: async () => {}});
            const count1 = await db.collection('Users').countDocuments();
            expect(count1).toBeGreaterThan(0);

            // Second call: the static-flag guard suppresses re-seed.
            await usersFeature.onBoot?.({db, redis: {} as any, services: built, reconnect: async () => {}});
            const count2 = await db.collection('Users').countDocuments();
            expect(count2).toBe(count1);
        } finally {
            if (prevPwd === undefined) delete process.env.ADMIN_DEFAULT_PASSWORD;
            else process.env.ADMIN_DEFAULT_PASSWORD = prevPwd;
        }
    });

    it('contributes the users SDL fragment — admin-only after CustomerAuth split (2026-05-02)', () => {
        expect(usersFeature.schemaSDL).toContain('setupAdmin');
        expect(usersFeature.schemaSDL).toContain('getUser');
        expect(usersFeature.schemaSDL).toContain('getUsers');
        expect(usersFeature.schemaSDL).toContain('addUser');
        expect(usersFeature.schemaSDL).toContain('updateUser');
        expect(usersFeature.schemaSDL).toContain('removeUser');
        // Customer-side surface lives on the CustomerAuth feature now.
        expect(usersFeature.schemaSDL).not.toContain('me: ICustomer');
        expect(usersFeature.schemaSDL).not.toContain('signUpCustomer');
        expect(usersFeature.schemaSDL).not.toContain('updateMyProfile');
        expect(usersFeature.schemaSDL).not.toContain('changeMyPassword');
        expect(usersFeature.schemaSDL).not.toContain('saveMyAddress');
        expect(usersFeature.schemaSDL).not.toContain('deleteMyAddress');
        // platform-level fields stay in legacy schema for this PR.
        expect(usersFeature.schemaSDL).not.toContain('getMongoDBUri');
        expect(usersFeature.schemaSDL).not.toContain('loadData');
    });

    it('contributes admin role mutations only — customer auth lives on the customerAuth feature', () => {
        const reqs = usersFeature.authz?.mutationRequirements ?? {};
        expect(reqs.addUser).toBe('admin');
        expect(reqs.updateUser).toBe('admin');
        expect(reqs.removeUser).toBe('admin');
        expect(usersFeature.authz?.queryRequirements?.getUsers).toBe('admin');
        expect(usersFeature.authz?.queryRequirements?.setupAdmin).toBe('admin');
        // No customer surface here anymore.
        expect(usersFeature.authz?.customerMutations ?? []).toEqual([]);
        expect(usersFeature.authz?.customerQueries ?? []).toEqual([]);
        expect(usersFeature.authz?.customerSessionInjected ?? []).toEqual([]);
        expect(usersFeature.authz?.anonOpenMutations ?? []).toEqual([]);
    });

    it('omits resolvers (users goes through guarded mongo proxy + manual `me` resolver)', () => {
        expect(usersFeature.resolvers).toBeUndefined();
    });
});
