import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {seoFeature} from '@services/features/Seo/feature.manifest';
import {SiteFlagsService} from '@services/features/Seo/SiteFlagsService';
import {SiteSeoService} from '@services/features/Seo/SiteSeoService';

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
    db = client.db(`seo_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('seoFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(seoFeature.id).toBe('seo');
        expect(seoFeature.displayName).toBe('SEO & site flags');
    });

    it('does not declare requires', () => {
        expect(seoFeature.requires).toBeUndefined();
    });

    it('services factory returns siteFlags + siteSeo keys', () => {
        const built = seoFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built).sort()).toEqual(['siteFlags', 'siteSeo']);
        expect(built?.siteFlags).toBeInstanceOf(SiteFlagsService);
        expect(built?.siteSeo).toBeInstanceOf(SiteSeoService);
    });

    it('contributes the SEO/SiteFlags SDL fragment (Phase C.2)', () => {
        expect(seoFeature.schemaSDL).toContain('getSiteFlags');
        expect(seoFeature.schemaSDL).toContain('getSiteSeo');
        expect(seoFeature.schemaSDL).toContain('saveSiteFlags');
        expect(seoFeature.schemaSDL).toContain('saveSiteSeo');
        // getFeatureFlags is a platform-level query; intentionally NOT here.
        expect(seoFeature.schemaSDL).not.toContain('getFeatureFlags');
    });

    it('contributes admin/editor mutationRequirements + session injection', () => {
        expect(seoFeature.authz?.mutationRequirements?.saveSiteFlags).toBe('admin');
        expect(seoFeature.authz?.mutationRequirements?.saveSiteSeo).toBe('editor');
        expect(seoFeature.authz?.sessionInjected).toContain('saveSiteFlags');
        expect(seoFeature.authz?.sessionInjected).toContain('saveSiteSeo');
    });

    it('omits resolvers (seo goes through guarded mongo proxy)', () => {
        expect(seoFeature.resolvers).toBeUndefined();
    });
});
