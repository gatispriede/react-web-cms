import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {customerAuthFeature} from './feature.manifest';
import {CustomerAuthService} from './CustomerAuthService';

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
    db = client.db(`customerauth_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('customerAuthFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(customerAuthFeature.id).toBe('customerAuth');
        expect(customerAuthFeature.displayName).toBe('Customer accounts');
    });

    it('services factory returns a `customerAuth` key holding a CustomerAuthService', () => {
        const built = customerAuthFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['customerAuth']);
        expect(built?.customerAuth).toBeInstanceOf(CustomerAuthService);
    });

    it('shares the Users collection (kind discriminator) with the Users feature', async () => {
        const built = customerAuthFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}}) ?? {};
        const svc = built.customerAuth as CustomerAuthService;
        await svc.signUpCustomer({user: {email: 'shared@x.com', password: 'pw'} as any});
        // Verify the doc landed in the shared `Users` collection with kind=customer.
        const doc = await db.collection('Users').findOne({email: 'shared@x.com'});
        expect(doc).toBeDefined();
        expect((doc as any).kind).toBe('customer');
    });

    it('contributes the customer SDL fragment', () => {
        expect(customerAuthFeature.schemaSDL).toContain('me: ICustomer');
        expect(customerAuthFeature.schemaSDL).toContain('signUpCustomer');
        expect(customerAuthFeature.schemaSDL).toContain('updateMyProfile');
        expect(customerAuthFeature.schemaSDL).toContain('changeMyPassword');
        expect(customerAuthFeature.schemaSDL).toContain('saveMyAddress');
        expect(customerAuthFeature.schemaSDL).toContain('deleteMyAddress');
        // Admin surface stays on the Users feature.
        expect(customerAuthFeature.schemaSDL).not.toContain('addUser');
        expect(customerAuthFeature.schemaSDL).not.toContain('removeUser');
    });

    it('contributes customerMutations / customerQueries / anon signUp authz', () => {
        const cm = customerAuthFeature.authz?.customerMutations ?? [];
        expect(cm).toContain('updateMyProfile');
        expect(cm).toContain('changeMyPassword');
        expect(cm).toContain('saveMyAddress');
        expect(cm).toContain('deleteMyAddress');
        const cq = customerAuthFeature.authz?.customerQueries ?? [];
        expect(cq).toContain('getMe');
        expect(customerAuthFeature.authz?.anonOpenMutations).toContain('signUpCustomer');
        const csi = customerAuthFeature.authz?.customerSessionInjected ?? [];
        expect(csi).toContain('getMe');
        expect(csi).toContain('updateMyProfile');
    });
});
