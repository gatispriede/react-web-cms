import {InSection} from "@interfaces/IMongo";
import IImage, {InImage} from "@interfaces/IImage";
import {ISection} from "@interfaces/ISection";
import {IConfigSectionAddRemove} from "@interfaces/IConfigSectionAddRemove";
import {IPage} from "@interfaces/IPage";
import {INavigation} from "@interfaces/INavigation";
import {ILogo} from "@interfaces/ILogo";
import {IUser} from "@interfaces/IUser";
import {INewLanguage} from "@interfaces/INewLanguage";
import {UserApi} from "./UserApi";
import {AssetApi} from "./AssetApi";
import {LanguageApi} from "./LanguageApi";
import {NavigationApi} from "./NavigationApi";
import {SectionApi} from "./SectionApi";

/**
 * Facade over focused domain APIs. Prefer importing the specific
 * {User,Asset,Language,Navigation,Section}Api in new code.
 */
class MongoApi {
    private readonly userApi = new UserApi();
    private readonly assetApi = new AssetApi();
    private readonly languageApi = new LanguageApi();
    private readonly navigationApi = new NavigationApi();
    private readonly sectionApi = new SectionApi();

    getUser = (args: { email: string }): Promise<Partial<IUser> | null> => this.userApi.getUser(args);
    /**
     * Customer-side Google sign-in landing point. NextAuth's signIn callback
     * calls this on first touch — service-side it's idempotent on `googleSub`
     * and links to an existing customer when the email already has a doc.
     */
    addCustomerFromGoogle = async (args: {email: string; name?: string; googleSub: string}): Promise<{id?: string; error?: string; raw?: string}> => {
        try {
            // Direct service call — runs server-side from the NextAuth
            // callback. We use `eval('require')` instead of a dynamic
            // `import()` because Turbopack/webpack still walks dynamic
            // imports during browser-bundle analysis. Pulling
            // `mongoDBConnection` into the client graph drags in mongo,
            // nodemailer, bcrypt, and every server-only service. The
            // eval'd require is opaque to the bundler, so the chain stops
            // at MongoApi's boundary.
            // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-eval
            const nodeRequire = eval('require') as NodeJS.Require;
            const {getMongoConnection} = nodeRequire('@services/infra/mongoDBConnection');
            const conn = getMongoConnection() as any;
            const raw: string = await conn.addCustomerFromGoogle(args);
            const parsed = JSON.parse(raw || '{}');
            if (parsed.error) return {error: parsed.error};
            return {id: parsed.createCustomer?.id, raw};
        } catch (err) {
            return {error: String(err)};
        }
    };

    getLogo = (): Promise<ILogo> => this.assetApi.getLogo();
    saveLogo = (content: string, expectedVersion?: number | null): Promise<{version?: number; error?: string}> => this.assetApi.saveLogo(content, expectedVersion);
    saveImage = (image: InImage): Promise<any> => this.assetApi.saveImage(image);
    deleteImage = (id: string): Promise<any> => this.assetApi.deleteImage(id);
    getImages = (tags: string): Promise<IImage[]> => this.assetApi.getImages(tags);
    rescanDiskImages = () => this.assetApi.rescanDiskImages();

    getLanguages = (): Promise<Record<string, INewLanguage>> => this.languageApi.getLanguages();
    saveLanguage = (language: INewLanguage, translations?: any, expectedVersion?: number | null) => this.languageApi.saveLanguage(language, translations, expectedVersion);
    deleteTranslation = (language: INewLanguage) => this.languageApi.deleteTranslation(language);

    createNavigation = (nav: INavigation) => this.navigationApi.createNavigation(nav);
    replaceUpdateNavigation = (oldPageName: string, nav: INavigation) =>
        this.navigationApi.replaceUpdateNavigation(oldPageName, nav);
    updateNavigation = (page: string, sections: string[]) => this.navigationApi.updateNavigation(page, sections);
    deleteNavigation = (pageName: string) => this.navigationApi.deleteNavigation(pageName);

    loadSections = (pageName: string, pages: IPage[]): Promise<ISection[]> =>
        this.sectionApi.loadSections(pageName, pages);
    deleteSection = (sectionId: string): Promise<string> => this.sectionApi.deleteSection(sectionId);
    addSectionToPage = (item: { section: InSection; pageName?: string }, sections: ISection[]) =>
        this.sectionApi.addSectionToPage(item, sections);
    addRemoveSectionItem = (
        sectionId: string | undefined,
        config: IConfigSectionAddRemove,
        sections: ISection[]
    ) => this.sectionApi.addRemoveSectionItem(sectionId, config, sections);
}

export default MongoApi;
