import {beforeEach, describe, expect, it, vi} from 'vitest';

// `MongoApi` is a thin facade — it constructs one of each domain API and
// forwards each call. Mock the modules at import time so the constructor
// hands the facade a fake instance per domain; the test then asserts each
// public method calls the correctly-named domain method with the original
// arguments. Catches: typos in the delegate name, missed args, accidental
// transformation. Doesn't exercise the underlying GraphQL — those paths
// have their own integration coverage.

const userApiMock = {getUser: vi.fn()};
const assetApiMock = {
    getLogo: vi.fn(), saveLogo: vi.fn(), saveImage: vi.fn(),
    deleteImage: vi.fn(), getImages: vi.fn(), rescanDiskImages: vi.fn(),
};
const languageApiMock = {getLanguages: vi.fn(), saveLanguage: vi.fn(), deleteTranslation: vi.fn()};
const navigationApiMock = {
    createNavigation: vi.fn(), replaceUpdateNavigation: vi.fn(),
    updateNavigation: vi.fn(), deleteNavigation: vi.fn(),
};
const sectionApiMock = {
    loadSections: vi.fn(), deleteSection: vi.fn(),
    addSectionToPage: vi.fn(), addRemoveSectionItem: vi.fn(),
};

// `new Class()` requires a real constructor — `vi.fn(() => obj)` doesn't satisfy that
// in vitest 4. Use a small class shim that returns the shared mock on each `new`.
vi.mock('./UserApi', () => ({UserApi: class { constructor() { return userApiMock; } }}));
vi.mock('./AssetApi', () => ({AssetApi: class { constructor() { return assetApiMock; } }}));
vi.mock('./LanguageApi', () => ({LanguageApi: class { constructor() { return languageApiMock; } }}));
vi.mock('./NavigationApi', () => ({NavigationApi: class { constructor() { return navigationApiMock; } }}));
vi.mock('./SectionApi', () => ({SectionApi: class { constructor() { return sectionApiMock; } }}));

// Import after mocks so the facade picks up the mocked constructors.
import MongoApi from './MongoApi';

describe('MongoApi facade', () => {
    let api: MongoApi;
    beforeEach(() => {
        vi.clearAllMocks();
        api = new MongoApi();
    });

    it('getUser → userApi.getUser with the same args', async () => {
        await api.getUser({email: 'x@y.z'});
        expect(userApiMock.getUser).toHaveBeenCalledWith({email: 'x@y.z'});
    });

    it('asset family → assetApi (one delegate per method)', async () => {
        await api.getLogo();
        await api.saveLogo('content-blob');
        await api.saveImage({id: 'img1'} as any);
        await api.deleteImage('img1');
        await api.getImages('All');
        await api.rescanDiskImages();
        expect(assetApiMock.getLogo).toHaveBeenCalledTimes(1);
        expect(assetApiMock.saveLogo).toHaveBeenCalledWith('content-blob', undefined);
        expect(assetApiMock.saveImage).toHaveBeenCalledWith({id: 'img1'});
        expect(assetApiMock.deleteImage).toHaveBeenCalledWith('img1');
        expect(assetApiMock.getImages).toHaveBeenCalledWith('All');
        expect(assetApiMock.rescanDiskImages).toHaveBeenCalledTimes(1);
    });

    it('language family → languageApi', async () => {
        await api.getLanguages();
        await api.saveLanguage({symbol: 'lv'} as any, {hello: 'sveiks'});
        await api.deleteTranslation({symbol: 'lv'} as any);
        expect(languageApiMock.getLanguages).toHaveBeenCalled();
        expect(languageApiMock.saveLanguage).toHaveBeenCalledWith({symbol: 'lv'}, {hello: 'sveiks'}, undefined);
        expect(languageApiMock.deleteTranslation).toHaveBeenCalledWith({symbol: 'lv'});
    });

    it('navigation family → navigationApi', async () => {
        const nav = {page: 'Home'} as any;
        await api.createNavigation(nav);
        await api.replaceUpdateNavigation('OldName', nav);
        await api.updateNavigation('Home', ['s1', 's2']);
        await api.deleteNavigation('Home');
        expect(navigationApiMock.createNavigation).toHaveBeenCalledWith(nav);
        expect(navigationApiMock.replaceUpdateNavigation).toHaveBeenCalledWith('OldName', nav);
        expect(navigationApiMock.updateNavigation).toHaveBeenCalledWith('Home', ['s1', 's2']);
        expect(navigationApiMock.deleteNavigation).toHaveBeenCalledWith('Home');
    });

    it('section family → sectionApi (preserves all positional args)', async () => {
        const sections = [{id: 's1'}] as any;
        await api.loadSections('Home', [{page: 'Home', sections: ['s1']}] as any);
        await api.deleteSection('s1');
        await api.addSectionToPage({section: {type: 1} as any, pageName: 'Home'}, sections);
        await api.addRemoveSectionItem('s1', {index: 0, type: 'TEXT'} as any, sections);
        expect(sectionApiMock.loadSections).toHaveBeenCalledWith('Home', [{page: 'Home', sections: ['s1']}]);
        expect(sectionApiMock.deleteSection).toHaveBeenCalledWith('s1');
        expect(sectionApiMock.addSectionToPage).toHaveBeenCalledWith(
            {section: {type: 1}, pageName: 'Home'}, sections,
        );
        expect(sectionApiMock.addRemoveSectionItem).toHaveBeenCalledWith(
            's1', {index: 0, type: 'TEXT'}, sections,
        );
    });

    it('forwards return values straight from the domain API', async () => {
        sectionApiMock.deleteSection.mockResolvedValue('ok-payload');
        const out = await api.deleteSection('s1');
        expect(out).toBe('ok-payload');
    });
});
