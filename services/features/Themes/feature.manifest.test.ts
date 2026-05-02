import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {themesFeature} from '@services/features/Themes/feature.manifest';
import {ThemeService} from '@services/features/Themes/ThemeService';

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
    db = client.db(`themes_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('themesFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(themesFeature.id).toBe('themes');
        expect(themesFeature.displayName).toBe('Themes');
    });

    it('does not declare requires (ThemeService is leaf-level)', () => {
        expect(themesFeature.requires).toBeUndefined();
    });

    it('services factory returns a `themes` key holding a ThemeService', () => {
        const built = themesFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['themes']);
        expect(built?.themes).toBeInstanceOf(ThemeService);
    });

    it('onBoot calls seedIfEmpty on the constructed service', async () => {
        const built = themesFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}}) ?? {};
        await themesFeature.onBoot?.({db, redis: {} as any, services: built, reconnect: async () => {}});
        // Seeding inserts presets when collection is empty — verify at least
        // one theme landed.
        const count = await db.collection('Themes').countDocuments();
        expect(count).toBeGreaterThan(0);
    });

    it('contributes the themes SDL fragment (Phase C.2)', () => {
        expect(themesFeature.schemaSDL).toContain('getThemes');
        expect(themesFeature.schemaSDL).toContain('getActiveTheme');
        expect(themesFeature.schemaSDL).toContain('saveTheme');
        expect(themesFeature.schemaSDL).toContain('deleteTheme');
        expect(themesFeature.schemaSDL).toContain('setActiveTheme');
        expect(themesFeature.schemaSDL).toContain('resetPreset');
    });

    it('contributes editor mutationRequirements + session injection on the four mutations', () => {
        const reqs = themesFeature.authz?.mutationRequirements ?? {};
        expect(reqs.saveTheme).toBe('editor');
        expect(reqs.deleteTheme).toBe('editor');
        expect(reqs.setActiveTheme).toBe('editor');
        expect(reqs.resetPreset).toBe('editor');
        const inj = themesFeature.authz?.sessionInjected ?? [];
        expect(inj).toContain('saveTheme');
        expect(inj).toContain('deleteTheme');
        expect(inj).toContain('setActiveTheme');
        expect(inj).toContain('resetPreset');
    });

    it('omits resolvers (themes goes through guarded mongo proxy)', () => {
        expect(themesFeature.resolvers).toBeUndefined();
    });
});
