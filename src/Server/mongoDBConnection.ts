import {Collection, Db, MongoClient} from 'mongodb'
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
import {PostService} from './PostService';
import {InPost} from '../Interfaces/IPost';
import {FooterService} from './FooterService';
import {IFooterConfig} from '../Interfaces/IFooter';
import {ISiteFlags, SiteFlagsService} from './SiteFlagsService';
import {SiteSeoService} from './SiteSeoService';
import {ISiteSeoDefaults} from '../Interfaces/ISiteSeo';
import {ITranslationMetaMap, TranslationMetaService} from './TranslationMetaService';
import {PresenceService} from './PresenceService';
import {AuditService} from './AuditService';
import {ConflictError, isConflictError, serialiseConflict} from './conflict';
import {
    defaultSettings,
    ILoadData,
    IMongoDBConnection,
    ISettings,
    IUserService
} from "./mongoConfig";

/**
 * Run a mutation that might throw a `ConflictError` and serialise the result
 * to JSON the GraphQL `String!` mutation contract expects. ConflictError
 * becomes `{conflict: true, currentVersion, currentDoc, message}`; other
 * errors become `{error: …}`. Frontend API wrappers detect the `.conflict`
 * key and surface a `ConflictError` to the caller via
 * `src/frontend/lib/conflict.ts`.
 */
interface AuditTrace {
    collection: string;
    docId?: string;
    op: 'create' | 'update' | 'delete';
    actor?: {email?: string; role?: string};
    /** Small structured diff, honoured only if the total JSON size stays
     *  under AuditService's internal cap; oversize writes are recorded
     *  with a null diff so the chronology survives regardless. */
    diff?: {before?: unknown; after?: unknown} | null;
    tag?: string;
}

async function runMutation<T>(
    action: string,
    fn: () => Promise<T>,
    auditTrace?: ((result: T) => AuditTrace | undefined) | AuditTrace,
): Promise<string> {
    try {
        const result = await fn();
        if (auditTrace) {
            try {
                const trace = typeof auditTrace === 'function' ? auditTrace(result) : auditTrace;
                if (trace) {
                    const service = getMongoConnection().auditService;
                    if (service) void service.record(trace);
                }
            } catch (err) {
                // Audit must not block the mutation response.
                console.error(`[audit] record failed for ${action}:`, err);
            }
        }
        return JSON.stringify({[action]: result});
    } catch (err) {
        if (isConflictError(err)) {
            return serialiseConflict(err as ConflictError<unknown>);
        }
        return JSON.stringify({error: String((err as Error).message || err)});
    }
}

// const server = process.env.NODE_SERVER_PORT ? 'mongodb' : 'localhost';

// Implements all service interfaces for delegation
class MongoDBConnection implements IMongoDBConnection, IUserService {
    private static adminSeeded = false;
    private _settings: ISettings = defaultSettings
    private _adminName = process.env.ADMIN_USERNAME ?? 'Admin'
    /** Plain-text seed password — only used once to hash for the first-run admin user. */
    private _adminPassword = process.env.ADMIN_DEFAULT_PASSWORD ?? ''
    /** Pre-computed bcrypt hash — set ADMIN_PASSWORD_HASH to skip the hashing step on seed. */
    private _adminPasswordHash = process.env.ADMIN_PASSWORD_HASH ?? ''
    private _hashSaltRounds = Number(process.env.BCRYPT_ROUNDS) || 10

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
    public postService!: PostService;
    public footerService!: FooterService;
    public siteFlagsService!: SiteFlagsService;
    public siteSeoService!: SiteSeoService;
    public translationMetaService!: TranslationMetaService;
    public presenceService!: PresenceService;
    public auditService!: AuditService;

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
            this.postService = new PostService(this.db);
            this.footerService = new FooterService(this.db);
            this.siteFlagsService = new SiteFlagsService(this.db);
            this.siteSeoService = new SiteSeoService(this.db);
            this.translationMetaService = new TranslationMetaService(this.db);
            this.presenceService = new PresenceService(this.db);
            this.auditService = new AuditService(this.db);

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
                // One-shot visibility check for legacy "ghost" Navigation docs
                // — rows the old `updateNavigation` path upserted without a
                // `type: 'navigation'` marker, invisible to the admin UI but
                // still on disk. The root cause is fixed; we only warn so
                // operators with pre-fix databases know to run the cleanup
                // script. No auto-delete — silent data removal at boot is a
                // worse failure mode than a persistent log line.
                void this.warnOnGhostNavigations(navigationsDB);
            }
        }
    }

    private async warnOnGhostNavigations(navigation: Collection): Promise<void> {
        try {
            const count = await navigation.countDocuments({type: {$ne: 'navigation'}});
            if (count > 0) {
                console.warn(`[cleanup] ${count} ghost Navigation docs detected. Run: npx tsx --tsconfig src/Server/tsconfig.custom.json Scripts/cleanup-ghost-navigation.ts --apply`);
            }
        } catch (err) {
            console.error('[cleanup] ghost-navigation check failed:', err);
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
    async addUpdateLanguage({ language, translations, expectedVersion, _session }: { language: INewLanguage, translations: JSON, expectedVersion?: number | null, _session?: {email?: string} }): Promise<string> {
        return runMutation(
            'addUpdateLanguage',
            () => this.languageService.addUpdateLanguage({ language, translations, editedBy: _session?.email, expectedVersion }),
            (result) => ({
                collection: 'Language',
                docId: result?.symbol ?? language.symbol,
                op: 'update',
                actor: {email: _session?.email},
            }),
        );
    }
    async deleteLanguage({ language, _session }: { language: INewLanguage, _session?: {email?: string} }) {
        const res = await this.languageService.deleteLanguage({ language, deletedBy: _session?.email });
        try {
            void this.auditService?.record({
                collection: 'Language', docId: language.symbol, op: 'delete',
                actor: {email: _session?.email},
            });
        } catch (err) { console.error('[audit] deleteLanguage:', err); }
        return res;
    }

    // Delegate AssetService methods (IMongoDBConnection signatures)
    async getLogo() { return this.assetService.getLogo(); }
    async saveLogo({ content, expectedVersion, _session }: { content: string, expectedVersion?: number | null, _session?: {email?: string} }): Promise<string> {
        return runMutation(
            'saveLogo',
            () => this.assetService.saveLogo(content, _session?.email, expectedVersion),
            (result) => ({
                collection: 'Logo',
                docId: result?.id,
                op: 'update',
                actor: {email: _session?.email},
            }),
        );
    }
    async saveImage({ image }: { image: InImage }): Promise<string> { return this.assetService.saveImage(image); }
    async deleteImage({ id }: { id: string }): Promise<string> { return this.assetService.deleteImage(id); }
    async getImages({ tags }: { tags: string }) { return this.assetService.getImages(tags); }

    // Delegate NavigationService methods. `_session` is injected by the Next
    // route's authz Proxy (see authz.SESSION_INJECTED_METHODS); standalone
    // callers omit it → service falls back to anonymous edits.
    async createNavigation({ navigation }: { navigation: INavigation }): Promise<string> { return this.navigationService.createNavigation(navigation); }
    async updateNavigation({ page, sections, _session }: { page: string, sections: string[], _session?: {email?: string} }): Promise<string> { return this.navigationService.updateNavigation(page, sections, _session?.email); }
    async getNavigationCollection() { return this.navigationService.getNavigationCollection(); }
    async getSections({ ids }: { ids: string[] }) { return this.navigationService.getSections(ids); }
    async addUpdateSectionItem({ section, pageName, expectedVersion, _session }: { section: ISection, pageName?: string, expectedVersion?: number | null, _session?: {email?: string} }): Promise<string> {
        try {
            const res = await this.navigationService.addUpdateSectionItem({ section: section as unknown as InSection, pageName, editedBy: _session?.email, expectedVersion });
            try {
                void this.auditService?.record({
                    collection: 'Section',
                    docId: (section as any)?.id,
                    op: (section as any)?.id ? 'update' : 'create',
                    actor: {email: _session?.email},
                });
            } catch (err) { console.error('[audit] addUpdateSectionItem:', err); }
            return res;
        } catch (err) {
            if (isConflictError(err)) return serialiseConflict(err as ConflictError<unknown>);
            throw err;
        }
    }
    async removeSectionItem({ id, _session }: { id: string, _session?: {email?: string} }): Promise<string> {
        const res = await this.navigationService.removeSectionItem(id);
        try {
            void this.auditService?.record({
                collection: 'Section', docId: id, op: 'delete',
                actor: {email: _session?.email},
            });
        } catch (err) { console.error('[audit] removeSectionItem:', err); }
        return res;
    }

    async loadData(): Promise<ILoadData[]> {
        if (!this.client) return [];
        const dbs = await this.client.db().admin().listDatabases();
        return dbs.databases;
    }

    async replaceUpdateNavigation({oldPageName, navigation, _session}: { oldPageName: string, navigation: INavigation, _session?: {email?: string} }): Promise<string> {
        return this.navigationService.replaceUpdateNavigation(oldPageName, navigation, _session?.email);
    }
    async deleteNavigationItem({pageName, _session}: { pageName: string, _session?: {email?: string} }): Promise<string> {
        return this.navigationService.deleteNavigationItem(pageName, _session?.email);
    }

    async publishSnapshot({note, _session}: {note?: string; _session?: {email?: string}} = {}): Promise<string> {
        try {
            const meta = await this.publishService.publishSnapshot(_session?.email, note);
            void this.auditService?.record({
                collection: 'PublishSnapshot', docId: (meta as any)?.id, op: 'create',
                actor: {email: _session?.email}, tag: 'publish',
            });
            return JSON.stringify({publishSnapshot: meta});
        } catch (err) {
            console.error('Error publishing snapshot:', err);
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async getPublishedHistory({limit}: {limit?: number} = {}): Promise<string> {
        try {
            return JSON.stringify(await this.publishService.getHistory(limit ?? 50));
        } catch (err) {
            console.error('getPublishedHistory:', err);
            return '[]';
        }
    }

    async rollbackToSnapshot({id, _session}: {id: string; _session?: {email?: string}}): Promise<string> {
        try {
            const meta = await this.publishService.rollbackTo(id, _session?.email);
            void this.auditService?.record({
                collection: 'PublishSnapshot', docId: id, op: 'update',
                actor: {email: _session?.email}, tag: 'rollback',
            });
            return JSON.stringify({rollbackToSnapshot: meta});
        } catch (err) {
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
    async saveTheme({theme, expectedVersion, _session}: {theme: InTheme; expectedVersion?: number | null; _session?: {email?: string}}): Promise<string> {
        return runMutation(
            'saveTheme',
            () => this.themeService.saveTheme(theme, _session?.email, expectedVersion),
            (result: any) => ({
                collection: 'Theme',
                docId: result?.id ?? (theme as any)?.id,
                op: (theme as any)?.id ? 'update' : 'create',
                actor: {email: _session?.email},
            }),
        );
    }
    async deleteTheme({id, _session}: {id: string; _session?: {email?: string}}): Promise<string> {
        try {
            const payload = await this.themeService.deleteTheme(id, _session?.email);
            void this.auditService?.record({
                collection: 'Theme', docId: id, op: 'delete',
                actor: {email: _session?.email},
            });
            return JSON.stringify({deleteTheme: payload});
        }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }
    async setActiveTheme({id, _session}: {id: string; _session?: {email?: string}}): Promise<string> {
        try {
            const payload = await this.themeService.setActive(id, _session?.email);
            void this.auditService?.record({
                collection: 'Theme', docId: id, op: 'update', tag: 'setActive',
                actor: {email: _session?.email},
            });
            return JSON.stringify({setActiveTheme: payload});
        }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async getPosts({includeDrafts, limit}: {includeDrafts?: boolean; limit?: number} = {}): Promise<string> {
        try { return JSON.stringify(await this.postService.list({includeDrafts, limit})); }
        catch (err) { console.error('getPosts:', err); return '[]'; }
    }
    async getPost({slug, includeDrafts}: {slug: string; includeDrafts?: boolean}): Promise<string | null> {
        try {
            const post = await this.postService.getBySlug(slug, {includeDrafts});
            return post ? JSON.stringify(post) : null;
        } catch (err) { console.error('getPost:', err); return null; }
    }
    async savePost({post, expectedVersion, _session}: {post: InPost; expectedVersion?: number | null; _session?: {email?: string}}): Promise<string> {
        return runMutation(
            'savePost',
            () => this.postService.save(post, _session?.email, expectedVersion),
            (result: any) => ({
                collection: 'Post',
                docId: result?.id ?? (post as any)?.id,
                op: (post as any)?.id ? 'update' : 'create',
                actor: {email: _session?.email},
            }),
        );
    }
    async deletePost({id, _session}: {id: string; _session?: {email?: string}}): Promise<string> {
        try {
            const payload = await this.postService.remove(id, _session?.email);
            void this.auditService?.record({
                collection: 'Post', docId: id, op: 'delete',
                actor: {email: _session?.email},
            });
            return JSON.stringify({deletePost: payload});
        }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }
    async setPostPublished({id, publish, _session}: {id: string; publish: boolean; _session?: {email?: string}}): Promise<string> {
        try {
            const payload = await this.postService.setPublished(id, publish, _session?.email);
            void this.auditService?.record({
                collection: 'Post', docId: id, op: 'update', tag: publish ? 'publish' : 'unpublish',
                actor: {email: _session?.email},
            });
            return JSON.stringify({setPostPublished: payload});
        }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async getFooter(): Promise<string> {
        try { return JSON.stringify(await this.footerService.get()); }
        catch (err) { console.error('getFooter:', err); return JSON.stringify({enabled: true, columns: [], bottom: ''}); }
    }
    async saveFooter({config, expectedVersion, _session}: {config: IFooterConfig; expectedVersion?: number | null; _session?: {email?: string}}): Promise<string> {
        return runMutation(
            'saveFooter',
            () => this.footerService.save(config, _session?.email, expectedVersion),
            () => ({collection: 'Footer', op: 'update', actor: {email: _session?.email}}),
        );
    }

    async getSiteFlags(): Promise<string> {
        try { return JSON.stringify(await this.siteFlagsService.get()); }
        catch (err) { console.error('getSiteFlags:', err); return JSON.stringify({blogEnabled: true}); }
    }
    async saveSiteFlags({flags, expectedVersion, _session}: {flags: Partial<ISiteFlags>; expectedVersion?: number | null; _session?: {email?: string}}): Promise<string> {
        return runMutation(
            'saveSiteFlags',
            () => this.siteFlagsService.save(flags, _session?.email, expectedVersion),
            () => ({collection: 'SiteFlags', op: 'update', actor: {email: _session?.email}}),
        );
    }

    async getSiteSeo(): Promise<string> {
        try { return JSON.stringify(await this.siteSeoService.get()); }
        catch (err) { console.error('getSiteSeo:', err); return '{}'; }
    }
    async saveSiteSeo({seo, expectedVersion, _session}: {seo: ISiteSeoDefaults; expectedVersion?: number | null; _session?: {email?: string}}): Promise<string> {
        return runMutation(
            'saveSiteSeo',
            () => this.siteSeoService.save(seo, _session?.email, expectedVersion),
            () => ({collection: 'SiteSeo', op: 'update', actor: {email: _session?.email}}),
        );
    }

    async getTranslationMeta(): Promise<string> {
        try {
            const [value, version] = await Promise.all([
                this.translationMetaService.get(),
                this.translationMetaService.getVersion(),
            ]);
            return JSON.stringify({value, version});
        }
        catch (err) { console.error('getTranslationMeta:', err); return JSON.stringify({value: {}, version: 0}); }
    }
    async getAuditLog({filter}: {filter?: {actorEmail?: string; collection?: string; docId?: string; op?: string; since?: string; until?: string; limit?: number; offset?: number}}): Promise<string> {
        try {
            const since = filter?.since ? new Date(filter.since) : undefined;
            const until = filter?.until ? new Date(filter.until) : undefined;
            const op = filter?.op === 'create' || filter?.op === 'update' || filter?.op === 'delete' ? filter.op : undefined;
            const {rows, total} = await this.auditService.list({
                actorEmail: filter?.actorEmail,
                collection: filter?.collection,
                docId: filter?.docId,
                op,
                since,
                until,
                limit: filter?.limit,
                offset: filter?.offset,
            });
            return JSON.stringify({rows, total});
        } catch (err) {
            console.error('getAuditLog:', err);
            return JSON.stringify({rows: [], total: 0, error: String(err)});
        }
    }
    async getAuditCollections(): Promise<string> {
        try { return JSON.stringify(await this.auditService.listCollections()); }
        catch (err) { console.error('getAuditCollections:', err); return '[]'; }
    }
    async getAuditActors(): Promise<string> {
        try { return JSON.stringify(await this.auditService.listActors()); }
        catch (err) { console.error('getAuditActors:', err); return '[]'; }
    }

    async saveTranslationMeta({meta, expectedVersion, _session}: {meta: ITranslationMetaMap; expectedVersion?: number | null; _session?: {email?: string}}): Promise<string> {
        return runMutation(
            'saveTranslationMeta',
            () => this.translationMetaService.save(meta, _session?.email, expectedVersion),
            () => ({collection: 'TranslationMeta', op: 'update', actor: {email: _session?.email}}),
        );
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
    async addUpdateNavigationItem({pageName, sections, _session}: { pageName: string, sections?: string[], _session?: {email?: string} }): Promise<string> {
        return this.navigationService.addUpdateNavigationItem(pageName, sections, _session?.email);
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