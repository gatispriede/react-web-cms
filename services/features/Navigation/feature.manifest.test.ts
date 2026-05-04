import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {navigationFeature} from '@services/features/Navigation/feature.manifest';
import {NavigationService} from '@services/features/Navigation/NavigationService';

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
    db = client.db(`navigation_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('navigationFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(navigationFeature.id).toBe('navigation');
        expect(navigationFeature.displayName).toBe('Navigation');
    });

    it('does not declare requires', () => {
        expect(navigationFeature.requires).toBeUndefined();
    });

    it('services factory returns a `navigation` key holding a NavigationService', () => {
        const built = navigationFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['navigation']);
        expect(built?.navigation).toBeInstanceOf(NavigationService);
    });

    it('onBoot is a no-op when there are no ghost navigation docs', async () => {
        // Just verify the hook executes without throwing on an empty DB.
        await expect(navigationFeature.onBoot?.({db, redis: {} as any, services: {}, reconnect: async () => {}}))
            .resolves.toBeUndefined();
    });

    it('contributes the navigation SDL fragment (Phase C.2) — incl. Sections collection ops', () => {
        expect(navigationFeature.schemaSDL).toContain('getNavigationCollection');
        expect(navigationFeature.schemaSDL).toContain('getSections');
        expect(navigationFeature.schemaSDL).toContain('createNavigation');
        expect(navigationFeature.schemaSDL).toContain('addUpdateNavigationItem');
        expect(navigationFeature.schemaSDL).toContain('updateNavigation');
        expect(navigationFeature.schemaSDL).toContain('replaceUpdateNavigation');
        expect(navigationFeature.schemaSDL).toContain('addUpdateSectionItem');
        expect(navigationFeature.schemaSDL).toContain('removeSectionItem');
        expect(navigationFeature.schemaSDL).toContain('deleteNavigationItem');
    });

    it('contributes editor mutationRequirements + session injection on edit-stamping mutations', () => {
        const reqs = navigationFeature.authz?.mutationRequirements ?? {};
        expect(reqs.createNavigation).toBe('editor');
        expect(reqs.addUpdateNavigationItem).toBe('editor');
        expect(reqs.updateNavigation).toBe('editor');
        expect(reqs.replaceUpdateNavigation).toBe('editor');
        expect(reqs.addUpdateSectionItem).toBe('editor');
        expect(reqs.removeSectionItem).toBe('editor');
        expect(reqs.deleteNavigationItem).toBe('editor');
        const inj = navigationFeature.authz?.sessionInjected ?? [];
        expect(inj).toContain('updateNavigation');
        expect(inj).toContain('replaceUpdateNavigation');
        expect(inj).toContain('addUpdateNavigationItem');
        expect(inj).toContain('deleteNavigationItem');
        expect(inj).toContain('addUpdateSectionItem');
        expect(inj).toContain('removeSectionItem');
    });

    it('omits resolvers (navigation goes through guarded mongo proxy)', () => {
        expect(navigationFeature.resolvers).toBeUndefined();
    });
});
