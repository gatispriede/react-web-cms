import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {ThemeService} from '@services/features/Themes/ThemeService';

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
    // seedIfEmpty is a static singleton guard (Promise-based since B2) —
    // reset so each test can seed against a fresh db.
    ThemeService._resetSeedingPromiseForTest();
});

describe('ThemeService', () => {
    it('seedIfEmpty seeds the first-class theme presets and makes the first one active', async () => {
        await service.seedIfEmpty();
        const list = await service.getThemes();
        // Preset list = first-class themes only as of 2026-05-13. Legacy
        // colour-only presets (Industrial / Studio / Paper / High contrast +
        // the inline Classic / Ocean / Brandappart / Forest / Midnight
        // blocks) were dropped because they only varied colour + radius
        // without module-level structural differences. Assertion is a >=5
        // floor so adding a new first-class theme doesn't require updating
        // this test.
        expect(list.length).toBeGreaterThanOrEqual(5);
        expect(list.every(t => t.custom === false)).toBe(true);
        // Every seeded preset must be a known first-class theme name.
        const FIRST_CLASS_NAMES = new Set(['Editorial', 'Commerce', 'SaaS Landing', 'Agency', 'Restaurant']);
        for (const t of list) expect(FIRST_CLASS_NAMES.has(t.name)).toBe(true);
        const active = await service.getActive();
        expect(active).not.toBeNull();
        expect(FIRST_CLASS_NAMES.has(active!.name)).toBe(true);
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
