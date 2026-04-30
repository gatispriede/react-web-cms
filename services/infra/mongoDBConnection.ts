import {Collection, Db, MongoClient} from 'mongodb'
import {INavigation} from "@interfaces/INavigation";
import {InImage} from "@interfaces/IImage";
import {IUser} from "@interfaces/IUser";
import {INewLanguage} from "@interfaces/INewLanguage";
import {ISection} from "@interfaces/ISection";
import {InSection} from "@interfaces/IMongo";
import FileManager from "@services/infra/fileManager";
import {UserService} from '@services/features/Users/UserService';
import {LanguageService} from '@services/features/Languages/LanguageService';
import {AssetService} from '@services/features/Assets/AssetService';
import {NavigationService} from '@services/features/Navigation/NavigationService';
import {BundleService} from '@services/features/Bundle/BundleService';
import {PublishService} from '@services/features/Publishing/PublishService';
import {ThemeService} from '@services/features/Themes/ThemeService';
import {InTheme} from '@interfaces/ITheme';
import {PostService} from '@services/features/Posts/PostService';
import {InPost} from '@interfaces/IPost';
import {ProductService} from '@services/features/Products/ProductService';
import {InProduct} from '@interfaces/IProduct';
import {CartService} from '@services/features/Cart/CartService';
import {CartOwner} from '@interfaces/ICart';
import {InventoryService} from '@services/features/Inventory/InventoryService';
import {createAdapter, MockAdapter} from '@services/features/Inventory/adapters';
import type {IWarehouseAdapter} from '@services/features/Inventory/adapters/IWarehouseAdapter';
import type {IAdapterConfig} from '@interfaces/IInventory';
import {RedisAdapter, type RedisLike} from '@services/infra/redis';
import {FooterService} from '@services/features/Footer/FooterService';
import {IFooterConfig} from '@interfaces/IFooter';
import {ISiteFlags, SiteFlagsService} from '@services/features/Seo/SiteFlagsService';
import {SiteSeoService} from '@services/features/Seo/SiteSeoService';
import {ISiteSeoDefaults} from '@interfaces/ISiteSeo';
import {ITranslationMetaMap, TranslationMetaService} from '@services/features/Languages/TranslationMetaService';
import {PresenceService} from '@services/features/Presence/PresenceService';
import {AuditService} from '@services/features/Audit/AuditService';
import {OrderService, type OrderMailer} from '@services/features/Orders/OrderService';
import {McpTokenService} from '@services/features/Mcp/McpTokenService';
import type {McpScope} from '@interfaces/IMcp';
import {StockReservationService} from '@services/features/Orders/StockReservationService';
import {getPaymentProvider} from '@services/features/Orders/payment';
import type {IOrderAddress, OrderStatus} from '@interfaces/IOrder';
import {ConflictError, isConflictError, serialiseConflict} from '@services/infra/conflict';
import {
    defaultSettings,
    ILoadData,
    IMongoDBConnection,
    ISettings,
    IUserService
} from "@services/infra/mongoConfig";

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
                    if (service) void service.record({...trace, actor: trace.actor ?? {}});
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

    /** Read-only accessor for the bound `Db` handle — lets infrequent
     *  call sites (one-off audit collections, ad-hoc queries) reach Mongo
     *  without us widening the field's visibility. Returns `undefined`
     *  until `setupClient()` finishes, so callers must null-check just
     *  like they would with the cached service references above. */
    public get database(): Db | undefined {
        return this.db;
    }

    public userService!: UserService;
    public languageService!: LanguageService;
    public assetService!: AssetService;
    public navigationService!: NavigationService;
    public bundleService!: BundleService;
    public publishService!: PublishService;
    public themeService!: ThemeService;
    public postService!: PostService;
    public productService!: ProductService;
    public cartService!: CartService;
    private cartRedis: RedisLike = new RedisAdapter();
    public inventoryService!: InventoryService;
    /** Cached adapter — invalidated when `saveAdapterConfig` writes a
     *  fresh value or when the InventoryService boots for the first time. */
    private inventoryAdapter: IWarehouseAdapter | null = null;
    public footerService!: FooterService;
    public siteFlagsService!: SiteFlagsService;
    public siteSeoService!: SiteSeoService;
    public translationMetaService!: TranslationMetaService;
    public presenceService!: PresenceService;
    public auditService!: AuditService;
    public stockReservationService!: StockReservationService;
    public orderService!: OrderService;
    public mcpTokenService!: McpTokenService;

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
            // 500ms connect timeout was causing cascading pool collapse on
            // small droplets: under light load, fresh TCP+handshake routinely
            // exceeded 500ms, closing the pool → next caller paid the full
            // connect cost again → every /api/* returned 502. 10s is the
            // driver default; keep it.
            connectTimeoutMS: 10_000,
            serverSelectionTimeoutMS: 5_000,
            // Don't churn idle conns every 3s — wasteful reconnects on quiet
            // periods. 60s idle is fine; pool caps prevent unbounded growth.
            maxIdleTimeMS: 60_000,
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
            this.productService = new ProductService(this.db);
            this.cartService = new CartService(this.db, this.cartRedis, this.productService);
            // Inventory: adapter is resolved lazily so the service can boot
            // before `SiteSettings.inventoryAdapterConfig` is written. The
            // env var beats the DB value (precedent: prefer ops-managed
            // secrets over self-service writes — see secrets.md). On unset
            // we fall back to the in-memory MockAdapter so the admin UI
            // doesn't blow up on a fresh install.
            this.inventoryAdapter = null;
            this.inventoryService = new InventoryService(
                this.db,
                this.productService,
                () => this.resolveInventoryAdapter(),
                {
                    triggerRevalidate: () => {
                        // Server-side fire-and-forget — same shape as the
                        // client helper but speaks to the same /api/revalidate
                        // endpoint via internal HTTP if the host is set, or
                        // is a no-op otherwise (build-time tests).
                        try {
                            const host = process.env.REVALIDATE_HOST || process.env.NEXT_PUBLIC_SITE_URL;
                            if (!host) return;
                            void fetch(`${host.replace(/\/$/, '')}/api/revalidate`, {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({scope: 'all'}),
                            }).catch((err) => console.warn('[inventory] revalidate failed', err));
                        } catch (err) {
                            console.warn('[inventory] revalidate failed', err);
                        }
                    },
                },
            );
            this.footerService = new FooterService(this.db);
            this.siteFlagsService = new SiteFlagsService(this.db);
            this.siteSeoService = new SiteSeoService(this.db);
            this.translationMetaService = new TranslationMetaService(this.db);
            this.presenceService = new PresenceService(this.db);
            this.auditService = new AuditService(this.db);
            this.stockReservationService = new StockReservationService(this.db, this.productService);
            this.mcpTokenService = new McpTokenService(this.db);
            // Mailer is best-effort: if `_inquiryMailer` is reachable
            // (UI layer, Next runtime) we wire it; tests / standalone
            // server skip and pass `undefined`. The dynamic import
            // means the services tree never hard-depends on the UI tree.
            const mailer: OrderMailer | undefined = (() => {
                if (typeof process !== 'undefined' && process.env && (process.env.SMTP_HOST || process.env.SMTP_HOST_FILE)) {
                    return {
                        sendOrderConfirmation: async (order, to) => {
                            try {
                                const mod: any = await import('@client/pages/api/_inquiryMailer').catch(() => null);
                                if (!mod || typeof mod.sendInquiryEmail !== 'function') {
                                    console.warn('[orders] mailer unreachable; SMTP env set but `_inquiryMailer` not loadable');
                                    return;
                                }
                                const subject = `Order confirmation ${order.orderNumber}`;
                                const total = (order.total / 100).toFixed(2);
                                const text = `Thanks for your order!\n\nOrder ${order.orderNumber}\nTotal: ${total} ${order.currency}\n`;
                                const html = `<h1>Thanks for your order!</h1><p>Order <strong>${order.orderNumber}</strong></p><p>Total: ${total} ${order.currency}</p>`;
                                await mod.sendInquiryEmail({to, subject, text, html});
                            } catch (err) {
                                console.error('[orders] sendOrderConfirmation:', err);
                            }
                        },
                    };
                }
                return undefined;
            })();
            this.orderService = new OrderService(
                this.db,
                this.productService,
                this.cartService,
                this.stockReservationService,
                getPaymentProvider(),
                mailer,
            );

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
                console.warn(`[cleanup] ${count} ghost Navigation docs detected. Run: npx tsx --tsconfig services/tsconfig.custom.json tools/scripts/cleanup-ghost-navigation.ts --apply`);
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

    // Customer-auth surface — separate from the admin user methods above.
    // The Proxy in `authz.ts` injects `_session.email` for customer-scoped
    // methods so the service can scope every Mongo query by the
    // authenticated customer rather than a client-supplied id.
    async signUpCustomer({customer}: {customer: any}) { return this.userService.signUpCustomer({user: customer}); }
    async addCustomerFromGoogle(args: {email: string; name?: string; googleSub: string}) {
        return this.userService.addCustomerFromGoogle(args);
    }
    async getMe(args: {_session?: {email?: string}; email?: string} = {}) { return this.userService.getMe(args); }
    async updateMyProfile({customer, _session}: {customer: any; _session?: {email?: string}}) {
        return this.userService.updateMyProfile({user: customer, _session});
    }
    async changeMyPassword(args: {oldPassword: string; newPassword: string; _session?: {email?: string}}) {
        return this.userService.changeMyPassword(args);
    }
    async saveMyAddress(args: {address: any; _session?: {email?: string}}) {
        return this.userService.saveMyAddress(args);
    }
    async deleteMyAddress(args: {id: string; _session?: {email?: string}}) {
        return this.userService.deleteMyAddress(args);
    }

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
    async resetPreset({id, _session}: {id: string; _session?: {email?: string}}): Promise<string> {
        try {
            const payload = await this.themeService.resetPreset(id, _session?.email);
            void this.auditService?.record({
                collection: 'Theme', docId: id, op: 'update', tag: 'resetPreset',
                actor: {email: _session?.email},
            });
            return JSON.stringify({resetPreset: payload});
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

    async getProducts({includeDrafts, limit, category, inStockOnly, source}: {includeDrafts?: boolean; limit?: number; category?: string; inStockOnly?: boolean; source?: string} = {}): Promise<string> {
        try {
            const src = source === 'manual' || source === 'warehouse' ? source : undefined;
            return JSON.stringify(await this.productService.list({includeDrafts, limit, category, inStockOnly, source: src}));
        }
        catch (err) { console.error('getProducts:', err); return '[]'; }
    }
    async getProduct({slug, includeDrafts}: {slug: string; includeDrafts?: boolean}): Promise<string | null> {
        try {
            const product = await this.productService.getBySlug(slug, {includeDrafts});
            return product ? JSON.stringify(product) : null;
        } catch (err) { console.error('getProduct:', err); return null; }
    }
    async searchProducts({q, limit, includeDrafts}: {q: string; limit?: number; includeDrafts?: boolean}): Promise<string> {
        try { return JSON.stringify(await this.productService.search(q, {limit, includeDrafts})); }
        catch (err) { console.error('searchProducts:', err); return '[]'; }
    }
    async saveProduct({product, expectedVersion, _session}: {product: InProduct; expectedVersion?: number | null; _session?: {email?: string}}): Promise<string> {
        return runMutation(
            'saveProduct',
            () => this.productService.save(product, _session?.email, expectedVersion),
            (result: any) => ({
                collection: 'Product',
                docId: result?.id ?? (product as any)?.id,
                op: (product as any)?.id ? 'update' : 'create',
                actor: {email: _session?.email},
            }),
        );
    }
    async deleteProduct({id, _session}: {id: string; _session?: {email?: string}}): Promise<string> {
        try {
            const payload = await this.productService.remove(id, _session?.email);
            void this.auditService?.record({
                collection: 'Product', docId: id, op: 'delete',
                actor: {email: _session?.email},
            });
            return JSON.stringify({deleteProduct: payload});
        }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }
    async setProductPublished({id, publish, _session}: {id: string; publish: boolean; _session?: {email?: string}}): Promise<string> {
        try {
            const payload = await this.productService.setPublished(id, publish, _session?.email);
            void this.auditService?.record({
                collection: 'Product', docId: id, op: 'update', tag: publish ? 'publish' : 'unpublish',
                actor: {email: _session?.email},
            });
            return JSON.stringify({setProductPublished: payload});
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

    // Cart surface — owner is supplied by the resolver (derived from
    // session/cookie, never from arguments). Customer cart mutations are
    // intentionally NOT audited (privacy + volume — see cart.md §11.8).
    async getCartFor(owner: CartOwner): Promise<string> {
        try { return JSON.stringify(await this.cartService.getCart(owner)); }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }
    async cartAddItem(owner: CartOwner, input: {productId: string; sku: string; qty: number}): Promise<string> {
        try { return JSON.stringify(await this.cartService.addItem(owner, input)); }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }
    async cartUpdateQty(owner: CartOwner, input: {productId: string; sku: string; qty: number}): Promise<string> {
        try { return JSON.stringify(await this.cartService.updateQty(owner, input)); }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }
    async cartRemoveItem(owner: CartOwner, input: {productId: string; sku: string}): Promise<string> {
        try { return JSON.stringify(await this.cartService.removeItem(owner, input)); }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }
    async cartClear(owner: CartOwner): Promise<string> {
        try { return JSON.stringify(await this.cartService.clear(owner)); }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }
    async cartMergeGuestIntoCustomer(cartId: string, customerId: string): Promise<void> {
        await this.cartService.mergeGuestIntoCustomer(cartId, customerId);
    }

    // -----------------------------------------------------------------
    // Inventory surface
    // -----------------------------------------------------------------

    /** Adapter resolution: env first (`INVENTORY_ADAPTER_CONFIG` JSON),
     *  `SiteSettings.inventoryAdapterConfig` second, MockAdapter fallback.
     *  Cached after first resolution; cleared by `saveAdapterConfig`. */
    private resolveInventoryAdapter(): IWarehouseAdapter {
        if (this.inventoryAdapter) return this.inventoryAdapter;
        // Env var first — ops-managed secrets beat self-service writes.
        const envCfg = (process.env.INVENTORY_ADAPTER_CONFIG || '').trim();
        if (envCfg) {
            try {
                const parsed = JSON.parse(envCfg) as IAdapterConfig;
                this.inventoryAdapter = createAdapter(parsed);
                return this.inventoryAdapter;
            } catch (err) {
                console.error('[inventory] INVENTORY_ADAPTER_CONFIG parse failed:', err);
            }
        }
        // Lazy-load from settings asynchronously; first call falls back to
        // mock and a follow-up settles cache once the DB read completes.
        if (this.inventoryService) {
            void this.inventoryService.readAdapterConfigRaw().then(cfg => {
                if (cfg) {
                    try { this.inventoryAdapter = createAdapter(cfg); }
                    catch (err) { console.error('[inventory] adapter rebuild failed:', err); }
                }
            }).catch(err => console.error('[inventory] adapter read failed:', err));
        }
        const mock = new MockAdapter();
        this.inventoryAdapter = mock;
        return mock;
    }

    async inventoryStatus(): Promise<string> {
        try { return JSON.stringify(await this.inventoryService.getStatus()); }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async inventoryReadDeadLetters({limit}: {limit?: number} = {}): Promise<string> {
        try { return JSON.stringify(await this.inventoryService.readDeadLetters({limit})); }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async inventorySyncAll({_session}: {_session?: {email?: string}} = {}): Promise<string> {
        try {
            const report = await this.inventoryService.syncAll();
            void this.auditService?.record({
                collection: 'InventoryRuns', docId: report.runId, op: 'create',
                actor: {email: _session?.email}, tag: `sync:all:${report.status}`,
            });
            return JSON.stringify({inventorySyncAll: report});
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async inventorySyncDelta({_session}: {_session?: {email?: string}} = {}): Promise<string> {
        try {
            const report = await this.inventoryService.syncDelta();
            void this.auditService?.record({
                collection: 'InventoryRuns', docId: report.runId, op: 'create',
                actor: {email: _session?.email}, tag: `sync:delta:${report.status}`,
            });
            return JSON.stringify({inventorySyncDelta: report});
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    // -----------------------------------------------------------------
    // Orders surface — see docs/features/checkout.md.
    // Customer / guest checkout-flow methods receive `_session` from the
    // authz Proxy so the service can apply per-session IDOR checks.
    // -----------------------------------------------------------------

    async myOrders({limit, _session}: {limit?: number; _session?: {customerId?: string}} = {}): Promise<string> {
        try {
            if (!_session?.customerId) return JSON.stringify([]);
            const orders = await this.orderService.listForCustomer(_session.customerId, limit ?? 25);
            return JSON.stringify(orders);
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async myOrder({id, _session}: {id: string; _session?: {customerId?: string}}): Promise<string | null> {
        try {
            if (!_session?.customerId) return null;
            const order = await this.orderService.getForCustomer(id, _session.customerId);
            return order ? JSON.stringify(order) : null;
        } catch (err) { console.error('myOrder:', err); return null; }
    }

    async orderByToken({token, cookieToken}: {token: string; cookieToken?: string | null}): Promise<string | null> {
        try {
            const order = await this.orderService.getByToken(token, cookieToken ?? null);
            return order ? JSON.stringify(order) : null;
        } catch (err) { console.error('orderByToken:', err); return null; }
    }

    async adminOrders({status, limit}: {status?: OrderStatus; limit?: number} = {}): Promise<string> {
        try {
            const orders = await this.orderService.listAll({status, limit});
            return JSON.stringify(orders);
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async adminOrder({id}: {id: string}): Promise<string | null> {
        try {
            const order = await this.orderService.getById(id);
            return order ? JSON.stringify(order) : null;
        } catch (err) { console.error('adminOrder:', err); return null; }
    }

    async shippingMethodsFor({orderId}: {orderId: string}): Promise<string> {
        try { return JSON.stringify(await this.orderService.shippingMethodsFor(orderId)); }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async createDraftOrder(args: {cartId?: string; currency: string; guestEmail?: string; _session?: {kind?: string; customerId?: string}}): Promise<string> {
        try {
            const customerId = args._session?.kind === 'customer' ? args._session.customerId : undefined;
            const order = await this.orderService.createDraftOrder({
                cartId: args.cartId,
                customerId,
                currency: args.currency,
                guestEmail: args.guestEmail,
            });
            return JSON.stringify({createDraftOrder: order});
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async attachOrderAddress(args: {orderId: string; shipping: IOrderAddress; billing?: IOrderAddress; _session?: any}): Promise<string> {
        try {
            const order = await this.orderService.attachOrderAddress({
                orderId: args.orderId,
                shipping: args.shipping,
                billing: args.billing,
                session: args._session,
            });
            return JSON.stringify({attachOrderAddress: order});
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async attachOrderShipping(args: {orderId: string; methodCode: string; _session?: any}): Promise<string> {
        try {
            const order = await this.orderService.attachOrderShipping({
                orderId: args.orderId,
                methodCode: args.methodCode,
                session: args._session,
            });
            return JSON.stringify({attachOrderShipping: order});
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async authorizeOrderPayment(args: {orderId: string; card: any; idempotencyKey: string; _session?: any}): Promise<string> {
        try {
            const result = await this.orderService.authorizeOrderPayment({
                orderId: args.orderId,
                card: args.card,
                idempotencyKey: args.idempotencyKey,
                session: args._session,
            });
            return JSON.stringify({authorizeOrderPayment: result});
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async finalizeOrder(args: {orderId: string; idempotencyKey: string; _session?: any}): Promise<string> {
        try {
            const order = await this.orderService.finalizeOrder({
                orderId: args.orderId,
                idempotencyKey: args.idempotencyKey,
                session: args._session,
            });
            return JSON.stringify({finalizeOrder: order});
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async cancelOrder(args: {orderId: string; _session?: any}): Promise<string> {
        try {
            const order = await this.orderService.cancelOrder({
                orderId: args.orderId,
                session: args._session,
            });
            return JSON.stringify({cancelOrder: order});
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async adminTransitionOrder({orderId, next, note, _session}: {orderId: string; next: OrderStatus; note?: string; _session?: {email?: string}}): Promise<string> {
        try {
            const order = await this.orderService.transition({orderId, next, by: _session?.email, note});
            void this.auditService?.record({
                collection: 'Order', docId: orderId, op: 'update', tag: `transition:${next}`,
                actor: {email: _session?.email},
            });
            return JSON.stringify({adminTransitionOrder: order});
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async adminRefundOrder({orderId, amount, reason, _session}: {orderId: string; amount?: number; reason?: string; _session?: {email?: string}}): Promise<string> {
        try {
            const order = await this.orderService.refund({orderId, amount, reason, by: _session?.email});
            void this.auditService?.record({
                collection: 'Order', docId: orderId, op: 'update', tag: 'refund',
                actor: {email: _session?.email},
            });
            return JSON.stringify({adminRefundOrder: order});
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    // -----------------------------------------------------------------
    // MCP token surface — admin-only (gated by graphqlResolvers / authz).
    // The MCP server itself reads tokens directly off `mcpTokenService`,
    // not through these methods — these exist to expose token CRUD over
    // the admin GraphQL surface so the admin UI can issue / revoke.
    // -----------------------------------------------------------------
    async mcpListTokens(): Promise<string> {
        try { return JSON.stringify(await this.mcpTokenService.listTokens()); }
        catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async mcpIssueToken({name, scopes, ttlDays, _session}: {name: string; scopes: string[]; ttlDays?: number | null; _session?: {email?: string}}): Promise<string> {
        try {
            const issued = await this.mcpTokenService.issueToken(
                {name, scopes: scopes as McpScope[], ttlDays: ttlDays ?? undefined},
                _session?.email ?? 'system',
            );
            void this.auditService?.record({
                collection: 'McpToken', docId: issued.id, op: 'create',
                actor: {email: _session?.email}, tag: 'mcp:issue',
            });
            return JSON.stringify({mcpIssueToken: issued});
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async mcpRevokeToken({id, _session}: {id: string; _session?: {email?: string}}): Promise<string> {
        try {
            const res = await this.mcpTokenService.revokeToken(id);
            void this.auditService?.record({
                collection: 'McpToken', docId: id, op: 'update',
                actor: {email: _session?.email}, tag: 'mcp:revoke',
            });
            return JSON.stringify({mcpRevokeToken: res});
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
    }

    async inventorySaveAdapterConfig({config, _session}: {config: any; _session?: {email?: string}}): Promise<string> {
        try {
            // Accept either a parsed JSON object or a stringified payload —
            // the GraphQL schema uses the JSON scalar but resolvers can
            // receive either.
            const parsed = typeof config === 'string' ? JSON.parse(config) : config;
            const result = await this.inventoryService.saveAdapterConfig(parsed as IAdapterConfig, _session?.email);
            // Invalidate cached adapter so the next sync rebuilds.
            this.inventoryAdapter = null;
            void this.auditService?.record({
                collection: 'InventoryAdapterConfig', op: 'update',
                actor: {email: _session?.email},
            });
            return JSON.stringify({inventorySaveAdapterConfig: result});
        } catch (err) { return JSON.stringify({error: String((err as Error).message || err)}); }
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