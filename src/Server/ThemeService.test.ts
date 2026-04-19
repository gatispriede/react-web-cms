import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {ThemeService} from './ThemeService';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let service: ThemeService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`theme_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    service = new ThemeService(db);
    // seedIfEmpty is a static singleton guard — reset so each test can seed fresh.
    (ThemeService as any).seeded = false;
});

describe('ThemeService', () => {
    it('seedIfEmpty seeds the preset list and makes the first preset active', async () => {
        await service.seedIfEmpty();
        const list = await service.getThemes();
        // Preset list is curated in ThemeService.PRESETS — covers editorial
        // themes (Industrial / Studio / Paper), the colour-only basics
        // (Classic / Ocean / Forest / Midnight), and the High contrast a11y
        // preset. Assertion is "every seeded row is a preset" rather than a
        // hard count so adding a preset doesn't require updating this test.
        expect(list.length).toBeGreaterThanOrEqual(8);
        expect(list.every(t => t.custom === false)).toBe(true);
        const active = await service.getActive();
        expect(active?.name).toBe('Industrial');
        expect(list.some(t => t.name === 'High contrast')).toBe(true);
    });

    it('saveTheme inserts custom themes and setActive switches them', async () => {
        await service.seedIfEmpty();
        const saved = await service.saveTheme({name: 'MyBrand', tokens: {colorPrimary: '#ff0088'}});
        expect(saved.id).toBeTruthy();
        await service.setActive(saved.id);
        const active = await service.getActive();
        expect(active?.name).toBe('MyBrand');
        expect(active?.tokens.colorPrimary).toBe('#ff0088');
    });

    it('saveTheme refuses to modify a preset', async () => {
        await service.seedIfEmpty();
        const [preset] = await service.getThemes();
        await expect(service.saveTheme({id: preset.id, name: preset.name, tokens: preset.tokens}))
            .rejects.toThrow(/preset/);
    });

    it('deleteTheme refuses to delete a preset', async () => {
        await service.seedIfEmpty();
        const [preset] = await service.getThemes();
        await expect(service.deleteTheme(preset.id)).rejects.toThrow(/preset/);
    });
});
