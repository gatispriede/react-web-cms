import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {footerFeature} from '@services/features/Footer/feature.manifest';
import {FooterService} from '@services/features/Footer/FooterService';

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
    db = client.db(`footer_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('footerFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(footerFeature.id).toBe('footer');
        expect(footerFeature.displayName).toBe('Footer');
    });

    it('does not declare requires', () => {
        expect(footerFeature.requires).toBeUndefined();
    });

    it('services factory returns a `footer` key holding a FooterService', () => {
        const built = footerFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['footer']);
        expect(built?.footer).toBeInstanceOf(FooterService);
    });

    it('contributes the footer SDL fragment (Phase C.2)', () => {
        expect(footerFeature.schemaSDL).toContain('getFooter');
        expect(footerFeature.schemaSDL).toContain('saveFooter');
    });

    it('contributes saveFooter editor mutationRequirement + session injection', () => {
        expect(footerFeature.authz?.mutationRequirements?.saveFooter).toBe('editor');
        expect(footerFeature.authz?.sessionInjected).toContain('saveFooter');
    });

    it('omits resolvers (footer goes through guarded mongo proxy)', () => {
        expect(footerFeature.resolvers).toBeUndefined();
    });
});
