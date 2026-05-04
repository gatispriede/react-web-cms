import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {languagesFeature} from '@services/features/Languages/feature.manifest';
import {LanguageService} from '@services/features/Languages/LanguageService';
import {TranslationMetaService} from '@services/features/Languages/TranslationMetaService';

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
    db = client.db(`languages_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('languagesFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(languagesFeature.id).toBe('languages');
        expect(languagesFeature.displayName).toBe('Languages & translations');
    });

    it('does not declare requires', () => {
        expect(languagesFeature.requires).toBeUndefined();
    });

    it('services factory returns languages + translationMeta keys', () => {
        const built = languagesFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built).sort()).toEqual(['languages', 'translationMeta']);
        expect(built?.languages).toBeInstanceOf(LanguageService);
        expect(built?.translationMeta).toBeInstanceOf(TranslationMetaService);
    });

    it('contributes the languages SDL fragment (Phase C.2)', () => {
        expect(languagesFeature.schemaSDL).toContain('getLanguages');
        expect(languagesFeature.schemaSDL).toContain('getTranslationMeta');
        expect(languagesFeature.schemaSDL).toContain('addUpdateLanguage');
        expect(languagesFeature.schemaSDL).toContain('deleteLanguage');
        expect(languagesFeature.schemaSDL).toContain('saveTranslationMeta');
    });

    it('contributes editor mutationRequirements + session injection for the three mutations', () => {
        expect(languagesFeature.authz?.mutationRequirements?.addUpdateLanguage).toBe('editor');
        expect(languagesFeature.authz?.mutationRequirements?.deleteLanguage).toBe('editor');
        expect(languagesFeature.authz?.mutationRequirements?.saveTranslationMeta).toBe('editor');
        expect(languagesFeature.authz?.sessionInjected).toContain('addUpdateLanguage');
        expect(languagesFeature.authz?.sessionInjected).toContain('deleteLanguage');
        expect(languagesFeature.authz?.sessionInjected).toContain('saveTranslationMeta');
    });

    it('omits resolvers (languages goes through guarded mongo proxy)', () => {
        expect(languagesFeature.resolvers).toBeUndefined();
    });
});
