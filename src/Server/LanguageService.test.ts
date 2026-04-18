import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db, Collection} from 'mongodb';
import {LanguageService} from './LanguageService';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let languages: Collection;
let service: LanguageService;
// Spy storage — stand in for FileManager's disk IO so the test stays pure.
let diskByLocale: Record<string, Record<string, string>>;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`langs_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    languages = db.collection('Languages');
    service = new LanguageService(languages, async () => {});
    diskByLocale = {};
    // Patch FileManager to a pure in-memory store so we don't touch the real
    // `public/locales/*` directory during tests.
    (service as any).fileManager = {
        readTranslation: (name: string) => diskByLocale[name] ?? {},
        saveTranslation: (name: string, translation: any) => { diskByLocale[name] = {...translation}; },
        deleteTranslation: (name: string) => { diskByLocale[name] = {}; },
    };
});

afterEach(() => vi.restoreAllMocks());

describe('LanguageService.addUpdateLanguage', () => {
    it('merges incoming translations over existing disk + Mongo state', async () => {
        await languages.insertOne({symbol: 'en', label: 'English', translations: {fromMongo: 'm', shared: 'mongo-version'}});
        diskByLocale['en'] = {fromDisk: 'd', shared: 'disk-version'};

        await service.addUpdateLanguage({
            language: {symbol: 'en', label: 'English'},
            translations: {newKey: 'fresh', shared: 'incoming-wins'} as any,
        });

        const after = await languages.findOne({symbol: 'en'}) as any;
        // mongoBase + diskBase + incoming  →  disk overrides mongo on conflict,
        // incoming overrides both.
        expect(after.translations.fromMongo).toBe('m');
        expect(after.translations.fromDisk).toBe('d');
        expect(after.translations.newKey).toBe('fresh');
        expect(after.translations.shared).toBe('incoming-wins');
        expect(diskByLocale['en'].fromMongo).toBe('m');
        expect(diskByLocale['en'].newKey).toBe('fresh');
    });

    it('does not wipe disk keys the admin UI did not touch', async () => {
        diskByLocale['en'] = {Home: 'Home', About: 'About', Contacts: 'Contacts'};

        await service.addUpdateLanguage({
            language: {symbol: 'en', label: 'English'},
            translations: {About: 'Updated About'} as any,
        });

        expect(diskByLocale['en']).toEqual({Home: 'Home', About: 'Updated About', Contacts: 'Contacts'});
    });

    it('upserts a brand new locale with exactly the incoming translations', async () => {
        await service.addUpdateLanguage({
            language: {symbol: 'de', label: 'Deutsch'},
            translations: {Hello: 'Hallo'} as any,
        });
        const doc = await languages.findOne({symbol: 'de'}) as any;
        expect(doc.label).toBe('Deutsch');
        expect(doc.translations).toEqual({Hello: 'Hallo'});
        expect(diskByLocale['de']).toEqual({Hello: 'Hallo'});
    });

    it('deleteLanguage removes the Mongo row and clears the disk JSON', async () => {
        await languages.insertOne({symbol: 'it', label: 'Italiano', translations: {Hello: 'Ciao'}});
        diskByLocale['it'] = {Hello: 'Ciao'};

        await service.deleteLanguage({language: {symbol: 'it', label: 'Italiano'}});

        expect(await languages.findOne({symbol: 'it'})).toBeNull();
        expect(diskByLocale['it']).toEqual({});
    });
});
