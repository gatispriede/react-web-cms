import {Db, MongoClient} from 'mongodb'
import {INavigation} from "../Interfaces/INavigation";
import {InImage} from "../Interfaces/IImage";
import {IUser} from "../Interfaces/IUser";
import {INewLanguage} from "../frontend/components/interfaces/INewLanguage";
import {ISection} from "../Interfaces/ISection";
import {InSection} from "../Interfaces/IMongo";
import FileManager from "./fileManager";
import {UserService} from './UserService';
import {LanguageService} from './LanguageService';
import {AssetService} from './AssetService';
import {NavigationService} from './NavigationService';
import {BundleService} from './BundleService';
import {PublishService} from './PublishService';
import {ThemeService} from './ThemeService';
import {InTheme} from '../Interfaces/ITheme';
import {
    defaultSettings,
    ILoadData,
    IMongoDBConnection,
    ISettings,
    IUserService
} from "./mongoConfig";

// const server = process.env.NODE_SERVER_PORT ? 'mongodb' : 'localhost';

// Implements all service interfaces for delegation
class MongoDBConnection implements IMongoDBConnection, IUserService {
    private static adminSeeded = false;
    private _settings: ISettings = defaultSettings
    private _adminName = 'Admin'
    private _adminPassword = 'b[ua25cJW2PF'
    private _adminPasswordHash = '$2b$10$M57z68x.otaoDBIgn3J16OXnaISuGLBca6dFsH2RB3ggr6OUBzDJ2'
    private _hashSaltRounds = 10

    private client!: MongoClient;
    private db: Db | undefined;
    private fileManager: FileManager;

    public userService!: UserService;
    public languageService!: LanguageService;
    public assetService!: AssetService;
    public navigationService!: NavigationService;
    public bundleService!: BundleService;
    public publishService!: PublishService;
    public themeService!: ThemeService;

    constructor() {
        this._settings.mongoDBDatabaseUrl = `mongodb+srv://${this._settings.mongodbUser}:${this._settings.mongodbPassword}@${this._settings.mongoDBClusterUrl}`;
        this.fileManager = new FileManager();
        void this.setupClient();
    }

    async setupClient() {
        if (this.db) {
            await this.client.close();
        }
        const dbUrl: string = this._settings.mongoDBLocalUrl;
        const newClient = new MongoClient(dbUrl, {
            retryReads: true,
            connectTimeoutMS: 500,
            maxIdleTimeMS: 3000,
            maxPoolSize: 80,
        });

        if (newClient) {
            this.db = newClient.db('DB');
            this.client = newClient;
            const reconnect = this.setupClient.bind(this);
            const sectionsDB = this.db.collection('Sections');
            const navigationsDB = this.db.collection('Navigation');
            const imagesDB = this.db.collection('Images');
            const usersDB = this.db.collection('Users');
            const logosDB = this.db.collection('Logos');
            const languagesDB = this.db.collection('Languages');
            this.userService = new UserService(usersDB, reconnect, this._adminName, this._adminPassword, this._adminPasswordHash, this._hashSaltRounds);
            this.languageService = new LanguageService(languagesDB, reconnect);
            this.assetService = new AssetService(logosDB, imagesDB, reconnect);
            this.navigationService = new NavigationService(navigationsDB, sectionsDB, reconnect);
            this.bundleService = new BundleService(this.db);
            this.publishService = new PublishService(this.db);
            this.themeService = new ThemeService(this.db);
            void this.themeService.seedIfEmpty();

            if (!MongoDBConnection.adminSeeded) {
                MongoDBConnection.adminSeeded = true;
                try {
                    const admin = await this.userService.setupAdmin();
                    if (admin) {
                        console.log(`[setup] Admin user ready: ${admin.email}`);
                    }
                } catch (err) {
                    MongoDBConnection.adminSeeded = false;
                    console.error('[setup] Failed to seed admin user:', err);
                }
            }
        }
    }

    // Delegate UserService methods
    async setupAdmin() { return this.userService.setupAdmin(); }
    async addUser({ user }: { user: any }) { return this.userService.addUser({ user }); }
    async updateUser({ user }: { user: any }) { return this.userService.updateUser({ user }); }
    async removeUser({ id }: { id: string }) { return this.userService.removeUser({ id }); }
    async getUser({ email }: { email: string }) { return this.userService.getUser({ email }); }
    async getUsers() { return this.userService.getUsers(); }

    // Delegate LanguageService methods
    async getLanguages() { return this.languageService.getLanguages(); }
    async addUpdateLanguage({ language, translations }: { language: INewLanguage, translations: JSON }) { return this.languageService.addUpdateLanguage({ language, translations }); }
    async deleteLanguage({ language }: { language: INewLanguage }) { return this.languageService.deleteLanguage({ language }); }

    // Delegate AssetService methods (IMongoDBConnection signatures)
    async getLogo() { return this.assetService.getLogo(); }
    async saveLogo({ content }: { content: string }): Promise<string> { return this.assetService.saveLogo(content); }
    async saveImage({ image }: { image: InImage }): Promise<string> { return this.assetService.saveImage(image); }
    async deleteImage({ id }: { id: string }): Promise<string> { return this.assetService.deleteImage(id); }
    async getImages({ tags }: { tags: string }) { return this.assetService.getImages(tags); }

    // Delegate NavigationService methods (IMongoDBConnection signatures)
    async createNavigation({ navigation }: { navigation: INavigation }): Promise<string> { return this.navigationService.createNavigation(navigation); }
    async updateNavigation({ page, sections }: { page: string, sections: string[] }): Promise<string> { return this.navigationService.updateNavigation(page, sections); }
    async getNavigationCollection() { return this.navigationService.getNavigationCollection(); }
    async getSections({ ids }: { ids: string[] }) { return this.navigationService.getSections(ids); }
    async addUpdateSectionItem({ section, pageName }: { section: ISection, pageName?: string }): Promise<string> { return this.navigationService.addUpdateSectionItem({ section: section as unknown as InSection, pageName }); }
    async removeSectionItem({ id }: { id: string }): Promise<string> { return this.navigationService.removeSectionItem(id); }

    async loadData(): Promise<ILoadData[]> {
        if (!this.client) return [];
        const dbs = await this.client.db().admin().listDatabases();
        return dbs.databases;
    }

    async replaceUpdateNavigation({oldPageName, navigation}: { oldPageName: string, navigation: INavigation }): Promise<string> {
        return this.navigationService.replaceUpdateNavigation(oldPageName, navigation);
    }
    async deleteNavigationItem({pageName}: { pageName: string }): Promise<string> {
        return this.navigationService.deleteNavigationItem(pageName);
    }

    async publishSnapshot(): Promise<string> {
        try {
            const meta = await this.publishService.publishSnapshot();
            return JSON.stringify({publishSnapshot: meta});
        } catch (err) {
            console.error('Error publishing snapshot:', err);
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async getPublishedSnapshot(): Promise<string | null> {
        try {
            const snap = await this.publishService.getActiveSnapshot();
            return snap ? JSON.stringify(snap) : null;
        } catch (err) {
            console.error('Error reading snapshot:', err);
            return null;
        }
    }

    async getThemes(): Promise<string> {
        try { return JSON.stringify(await this.themeService.getThemes()); }
        catch (err) { console.error('getThemes:', err); return '[]'; }
    }
    async getActiveTheme(): Promise<string | null> {
        try {
            const t = await this.themeService.getActive();
            return t ? JSON.stringify(t) : null;
        } catch (err) { console.error('getActiveTheme:', err); return null; }
    }
    async saveTheme({theme}: {theme: InTheme}): Promise<string> {
        try { return JSON.stringify({saveTheme: await this.themeService.saveTheme(theme)}); }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }
    async deleteTheme({id}: {id: string}): Promise<string> {
        try { return JSON.stringify({deleteTheme: await this.themeService.deleteTheme(id)}); }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }
    async setActiveTheme({id}: {id: string}): Promise<string> {
        try { return JSON.stringify({setActiveTheme: await this.themeService.setActive(id)}); }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async getPublishedMeta(): Promise<string | null> {
        try {
            const meta = await this.publishService.getActiveMeta();
            return meta ? JSON.stringify(meta) : null;
        } catch (err) {
            console.error('Error reading snapshot meta:', err);
            return null;
        }
    }
    async addUpdateNavigationItem({pageName, sections}: { pageName: string, sections?: string[] }): Promise<string> {
        return this.navigationService.addUpdateNavigationItem(pageName, sections);
    }

    getMongoDBUri(): string {
        return this._settings.mongoDBDatabaseUrl;
    }
}


let sharedInstance: MongoDBConnection | undefined;

export function getMongoConnection(): MongoDBConnection {
    if (!sharedInstance) {
        sharedInstance = new MongoDBConnection();
    }
    return sharedInstance;
}

export default MongoDBConnection