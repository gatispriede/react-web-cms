import {Db, MongoClient} from 'mongodb'
import {INavigation} from "@interfaces/INavigation";
import {InImage} from "@interfaces/IImage";
import {IUser} from "@interfaces/IUser";
import {INewLanguage} from "@interfaces/INewLanguage";
import {ISection} from "@interfaces/ISection";
import {InSection} from "@interfaces/IMongo";
import FileManager from "@services/infra/fileManager";
import type {UserService} from '@services/features/Users/UserService';
import type {LanguageService} from '@services/features/Languages/LanguageService';
import type {AssetService} from '@services/features/Assets/AssetService';
import type {NavigationService} from '@services/features/Navigation/NavigationService';
import type {BundleService} from '@services/features/Bundle/BundleService';
import type {PublishService} from '@services/features/Publishing/PublishService';
import type {ThemeService} from '@services/features/Themes/ThemeService';
import {InTheme} from '@interfaces/ITheme';
import type {PostService} from '@services/features/Posts/PostService';
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
import type {FooterService} from '@services/features/Footer/FooterService';
import {IFooterConfig} from '@interfaces/IFooter';
import type {SiteFlagsService} from '@services/features/Seo/SiteFlagsService';
import type {ISiteFlags} from '@services/features/Seo/SiteFlagsService';
import type {SiteSeoService} from '@services/features/Seo/SiteSeoService';
import {ISiteSeoDefaults} from '@interfaces/ISiteSeo';
import type {TranslationMetaService} from '@services/features/Languages/TranslationMetaService';
import type {ITranslationMetaMap} from '@services/features/Languages/TranslationMetaService';
import type {PresenceService} from '@services/features/Presence/PresenceService';
import type {ErrorLogService} from '@services/features/Observability/ErrorLogService';
import type {FeatureFlagsService} from '@services/features/FeatureFlags/FeatureFlagsService';
import {AuditService} from '@services/features/Audit/AuditService';
import type {OrderService} from '@services/features/Orders/OrderService';
import {McpTokenService} from '@services/features/Mcp/McpTokenService';
import type {McpScope} from '@interfaces/IMcp';
import type {StockReservationService} from '@services/features/Orders/StockReservationService';
import type {IOrderAddress, OrderStatus} from '@interfaces/IOrder';
import {ConflictError, isConflictError, serialiseConflict} from '@services/infra/conflict';
import {log} from '@services/infra/logger';
// Static import despite the cycle (Cart + Orders manifests pull
// `getMongoConnection` for per-request resolver thunks). ESM hoists
// the function bindings; nothing here calls `bootFeaturesSync` during
// module evaluation, so the partial-module phase is safe. The previous
// `require()` worked under Next's bundler but breaks under tsx ESM.
import {bootFeaturesSync, bootFeaturesAsync} from '@services/infra/featureRegistry';
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
                log.error({scope: 'audit.record', err, action}, 'audit record failed');
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
    private _settings: ISettings = defaultSettings

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

    /**
     * Users / Languages / Assets / Navigation / Bundle / Publishing /
     * Themes / Posts are owned by their respective feature manifests
     * (Phase B step 6 of the platform refactor). Each field stays as a
     * getter so existing call sites — `mongoConn.userService.addUser()`,
     * the delegate methods below, and the bundle-import script — keep
     * working unchanged. The underlying instances are now manifest-built
     * and live on `this.featureServices.<key>`. Returns `undefined` if
     * read before `bootFeatures` resolves; same null-handling expectation
     * as the other auto-initialised service fields.
     */
    public get userService(): UserService { return this.featureServices.users as UserService; }
    /**
     * Resolve the calling user's admin UI mode. Per-user setting wins;
     * falls back to `siteFlags.defaultAdminUiMode`, then to `'advanced'`.
     * Per `docs/features/platform/admin-ui-modes.md`.
     */
    async myAdminUiMode({_session}: {_session?: {email?: string}} = {}): Promise<string> {
        try {
            const email = (_session?.email ?? '').trim().toLowerCase();
            if (email) {
                const user = await this.userService.getUser({email});
                if (user?.adminUiMode === 'simplified' || user?.adminUiMode === 'advanced') {
                    return user.adminUiMode;
                }
            }
            const flags = await this.getSiteFlags();
            try {
                const parsed = JSON.parse(flags) as {defaultAdminUiMode?: 'simplified' | 'advanced'};
                if (parsed.defaultAdminUiMode === 'simplified' || parsed.defaultAdminUiMode === 'advanced') {
                    return parsed.defaultAdminUiMode;
                }
            } catch { /* fallthrough */ }
            return 'advanced';
        } catch {
            return 'advanced';
        }
    }
    async setMyAdminUiMode(args: {mode: 'simplified' | 'advanced'; _session?: {email?: string}}): Promise<string> {
        return this.userService.setMyAdminUiMode(args);
    }
    /**
     * Customer-side identity & profile service. Split out of `UserService`
     * (Class Loader L3 follow-up, 2026-05-02). Plug-and-play toggleable
     * via the `customerAuth` flag — when off this getter returns
     * `undefined` and the customer-method delegates below soft-fail with
     * a "feature disabled" envelope. Sharing the `Users` collection means
     * cross-kind email uniqueness still holds.
     */
    public get customerAuthService(): import('@services/features/CustomerAuth/CustomerAuthService').CustomerAuthService | undefined {
        return this.featureServices.customerAuth as import('@services/features/CustomerAuth/CustomerAuthService').CustomerAuthService | undefined;
    }
    public get languageService(): LanguageService { return this.featureServices.languages as LanguageService; }
    public get assetService(): AssetService { return this.featureServices.assets as AssetService; }
    public get navigationService(): NavigationService { return this.featureServices.navigation as NavigationService; }
    public get bundleService(): BundleService { return this.featureServices.bundle as BundleService; }
    public get publishService(): PublishService { return this.featureServices.publish as PublishService; }
    public get themeService(): ThemeService { return this.featureServices.themes as ThemeService; }
    public get postService(): PostService { return this.featureServices.posts as PostService; }
    /**
     * Products is owned by `services/features/Products/feature.manifest.ts`
     * (Phase B of the platform refactor). The field stays as a getter so
     * existing call sites — `mongoConn.productService.list(...)`, the
     * `getProducts` / `saveProduct` / etc. delegate methods below, and
     * downstream services constructed with `this.productService` (Cart,
     * Order, StockReservation, Inventory) — keep working unchanged.
     * Returns `undefined` if read before `bootFeatures` resolves; same
     * null-handling expectation as the other auto-initialised fields.
     *
     * Cart's manifest factory falls back to this getter when
     * `services.products` isn't present yet; declaring `requires:
     * ['products']` on Cart guarantees Products boots first, so the
     * fallback only fires from non-registry callers (direct unit tests
     * etc.).
     */
    public get productService(): ProductService {
        return this.featureServices.products as ProductService;
    }
    /**
     * Cart is owned by `services/features/Cart/feature.manifest.ts` (Phase B
     * of the platform refactor). The field stays as a getter so existing
     * call sites — `mongoConn.cartService.addItem(...)`, `cartAddItem()`,
     * `cartMergeGuestIntoCustomer()` etc. — keep working unchanged. The
     * underlying instance is now manifest-built and lives on
     * `this.featureServices.cart`. Returns `undefined` if read before
     * `bootFeatures` resolves; same null-handling expectation as the
     * other auto-initialised service fields.
     */
    public get cartService(): CartService {
        return this.featureServices.cart as CartService;
    }
    private cartRedis: RedisLike = new RedisAdapter();
    /**
     * Inventory is owned by `services/features/Inventory/feature.manifest.ts`
     * (Phase B of the platform refactor). The field stays as a getter so
     * existing call sites — `mongoConn.inventoryService.getStatus()`, the
     * `inventoryStatus` / `inventorySyncAll` / `inventorySaveAdapterConfig`
     * delegate methods below, and the lazy adapter resolver
     * (`resolveInventoryAdapter`) which reads back through
     * `this.inventoryService.readAdapterConfigRaw()` — keep working
     * unchanged. The underlying instance is now manifest-built and lives
     * on `this.featureServices.inventory`. Returns `undefined` if read
     * before `bootFeatures` resolves; same null-handling expectation as
     * the other auto-initialised service fields.
     */
    public get inventoryService(): InventoryService {
        return this.featureServices.inventory as InventoryService;
    }
    /** Cached adapter — invalidated when `saveAdapterConfig` writes a
     *  fresh value or when the InventoryService boots for the first time.
     *  Public so the Inventory manifest factory's adapter resolver can
     *  reach it without widening the rest of the connection's surface. */
    public inventoryAdapter: IWarehouseAdapter | null = null;
    /**
     * Footer / SiteFlags / SiteSeo / TranslationMeta / Presence /
     * ErrorLog are owned by their respective feature manifests (Phase B
     * step 6). The Seo manifest exposes both `siteFlags` and `siteSeo`
     * keys; the Languages manifest exposes both `languages` and
     * `translationMeta`; Observability exposes `errorLog`. Each getter
     * here maps the legacy field name back to its `featureServices` slot.
     */
    public get footerService(): FooterService { return this.featureServices.footer as FooterService; }
    public get siteFlagsService(): SiteFlagsService { return this.featureServices.siteFlags as SiteFlagsService; }
    public get siteSeoService(): SiteSeoService { return this.featureServices.siteSeo as SiteSeoService; }
    public get translationMetaService(): TranslationMetaService { return this.featureServices.translationMeta as TranslationMetaService; }
    public get presenceService(): PresenceService { return this.featureServices.presence as PresenceService; }
    public get errorLogService(): ErrorLogService { return this.featureServices.errorLog as ErrorLogService; }
    public get featureFlagsService(): FeatureFlagsService { return this.featureServices.featureFlags as FeatureFlagsService; }
    /**
     * Server-restart service. Owns graceful-shutdown + supervisor
     * respawn, plus the runtime view of pending restart reasons. The
     * admin UI banner reads through `getRestartStatus`; the restart
     * button hits `requestServerRestart` (admin-only, audit-logged,
     * rate-limited). See `docs/features/platform/server-restart.md`.
     */
    public get serverRestartService(): import('@services/features/ServerRestart/ServerRestartService').ServerRestartService {
        return this.featureServices.serverRestart as import('@services/features/ServerRestart/ServerRestartService').ServerRestartService;
    }
    async getRestartStatus(): Promise<string> {
        return JSON.stringify(this.serverRestartService.status());
    }
    async requestServerRestart({_session}: {_session?: {email?: string}} = {}): Promise<string> {
        const result = this.serverRestartService.requestRestart(_session?.email);
        return JSON.stringify(result);
    }

    /**
     * Analytics — first-party event ingest + canned summary.
     * `trackEvent` is public (anonOpenMutations); `analyticsSummary` is
     * admin-only. Both flow through `featureServices.analytics`; if the
     * `analytics` plug-and-play flag is off the service is undefined and
     * the delegates short-circuit.
     */
    public get analyticsService(): import('@services/features/Analytics/AnalyticsService').AnalyticsService | undefined {
        return this.featureServices.analytics as import('@services/features/Analytics/AnalyticsService').AnalyticsService | undefined;
    }
    async trackEvent({events, ip, _session}: {events: unknown[]; ip?: string; _session?: {kind?: string; email?: string; customerId?: string}}): Promise<string> {
        const svc = this.analyticsService;
        if (!svc) return JSON.stringify({accepted: 0, error: 'analytics disabled'});
        // `userId` only stamped for logged-in customer sessions; admin
        // session traffic is intentionally NOT analytics-tracked.
        const userId = _session?.kind === 'customer' ? _session.customerId : undefined;
        // `ip` is consumed by `ingest` for country derivation only and
        // never persisted. Do not capture it into a closure or log.
        const result = await svc.ingest(events, userId, ip);
        return JSON.stringify(result);
    }
    async analyticsSummary({range}: {range: string}): Promise<string> {
        const svc = this.analyticsService;
        if (!svc) return JSON.stringify({error: 'analytics disabled'});
        return svc.summary(range);
    }

    /**
     * Permissions — resource-scoped edit grants + functional-role
     * registry surface. Per `docs/features/platform/edit-levels.md`.
     */
    public get permissionService(): import('@services/features/Permissions/PermissionService').PermissionService {
        return this.featureServices.permissions as import('@services/features/Permissions/PermissionService').PermissionService;
    }
    async permissionsForUser({userId}: {userId: string}): Promise<string> {
        try { return JSON.stringify(await this.permissionService.listForUser(userId)); }
        catch (err) { return JSON.stringify({error: String((err as Error).message ?? err)}); }
    }
    async grantPermission({userId, scope, resourceId, _session}: {
        userId: string; scope: string; resourceId: string; _session?: {email?: string};
    }): Promise<string> {
        try {
            const row = await this.permissionService.grant({
                userId,
                scope: scope as 'page' | 'module' | 'element',
                resourceId,
                grantedBy: _session?.email ?? 'unknown',
            });
            return JSON.stringify({grantPermission: row});
        } catch (err) { return JSON.stringify({error: String((err as Error).message ?? err)}); }
    }
    async revokePermission({userId, scope, resourceId}: {userId: string; scope: string; resourceId: string}): Promise<string> {
        try {
            const result = await this.permissionService.revoke({
                userId,
                scope: scope as 'page' | 'module' | 'element',
                resourceId,
            });
            return JSON.stringify({revokePermission: result});
        } catch (err) { return JSON.stringify({error: String((err as Error).message ?? err)}); }
    }
    async functionalRoles(): Promise<string> {
        // Module-import to avoid a top-of-file cycle through featureRegistry.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const {composedFunctionalRoles} = require('@services/infra/featureRegistry');
        return JSON.stringify(composedFunctionalRoles());
    }
    /**
     * Service map populated by `bootFeatures` from the manifest registry.
     * Phase A of the platform refactor: features that have a manifest
     * land their service instance here; legacy fields above stay until
     * the matching migration commit retires them. Resolvers consume
     * services from this map via `ctx.services.<id>` once a feature is
     * fully migrated.
     */
    public featureServices: Record<string, unknown> = {};
    public auditService!: AuditService;
    /**
     * Orders is owned by `services/features/Orders/feature.manifest.ts`
     * (Phase B step 4 of the platform refactor). Both `orderService` and
     * `stockReservationService` are now manifest-built and exposed via
     * getters over `featureServices`. Existing call sites — the
     * `myOrders` / `createDraftOrder` / etc. delegate methods below, the
     * sweeper script, and the GraphQL resolvers — keep working unchanged.
     * Returns `undefined` if read before `bootFeatures` resolves; same
     * null-handling expectation as the other auto-initialised service
     * fields.
     */
    public get orderService(): OrderService {
        return this.featureServices.orders as OrderService;
    }
    public get stockReservationService(): StockReservationService {
        return this.featureServices.stockReservation as StockReservationService;
    }
    /**
     * MCP tokens are owned by `services/features/Mcp/feature.manifest.ts`
     * (Phase B step 5 of the platform refactor). The field stays as a
     * getter so existing call sites — `mongoConn.mcpTokenService` (read
     * directly by the MCP server + its tools index), the
     * `mcpListTokens` / `mcpIssueToken` / `mcpRevokeToken` delegates
     * below — keep working unchanged. The underlying instance is now
     * manifest-built and lives on `this.featureServices.mcp`. Returns
     * `undefined` if read before `bootFeatures` resolves; same
     * null-handling expectation as the other auto-initialised service
     * fields.
     */
    public get mcpTokenService(): McpTokenService {
        return this.featureServices.mcp as McpTokenService;
    }

    /**
     * Resolves when async boot finishes — index ensuring + every
     * feature's `onBoot` hook. Service CONSTRUCTION is synchronous and
     * complete before the constructor returns; this promise covers the
     * lifecycle work that comes after. Callers that specifically need
     * indexes / admin-seed / theme presets in place (rare cold-boot
     * sensitive paths) await this; routine service access doesn't.
     */
    public ready: Promise<void>;

    constructor() {
        this._settings.mongoDBDatabaseUrl = `mongodb+srv://${this._settings.mongodbUser}:${this._settings.mongodbPassword}@${this._settings.mongoDBClusterUrl}`;
        this.fileManager = new FileManager();

        // Open the client + db handles synchronously. The MongoDB driver
        // doesn't actually connect here — `client.db()` is lazy and the
        // real network round-trip happens on the first operation. That
        // lets every feature service factory store the `db` handle in
        // its constructor and become callable immediately, even though
        // the client is still mid-handshake in the background.
        this.client = new MongoClient(this._settings.mongoDBLocalUrl, {
            retryReads: true,
            connectTimeoutMS: 10_000,
            serverSelectionTimeoutMS: 5_000,
            maxIdleTimeMS: 60_000,
            maxPoolSize: 80,
        });
        this.db = this.client.db('DB');

        // Synchronous half of the manifest registry — every feature
        // service factory runs now so `featureServices.*` is populated
        // before the constructor returns. Without this, the FIRST HTTP
        // request after a cold boot reads undefined off the manifest-
        // built getters and crashes resolvers.
        try {
            const reconnect = this.setupClient.bind(this);
            this.featureServices = bootFeaturesSync({db: this.db, redis: this.cartRedis, reconnect});
        } catch (err) {
            log.error({scope: 'feature.boot.sync', err}, 'sync feature boot failed');
        }

        // Mirror the manifest's audit service onto the legacy field so
        // `runMutation`'s audit-trail writes (which read
        // `getMongoConnection().auditService`) work pre-boot too.
        this.auditService = (this.featureServices.audit as AuditService) ?? new AuditService(this.db);

        this.ready = this.setupClient().catch((err) => {
            log.error({scope: 'mongo.setup', err}, 'setupClient failed');
        });
    }

    /**
     * Toggles to `false` after the first setupClient call. The constructor
     * already opens the client + populates `this.db` synchronously, so the
     * very first `setupClient()` call (kicked off via `this.ready`) just
     * runs the async tail — no close, no re-open. Subsequent calls (e.g.
     * the reconnect callback wired into per-feature factories) go through
     * the full close-and-reopen path.
     */
    private _hasOpenedClient = true;

    async setupClient() {
        if (this._hasOpenedClient) {
            // First call after construction — skip close+reopen. Just run
            // the async tail below: index ensure + onBoot hooks.
            this._hasOpenedClient = false;
        } else {
            if (this.db) {
                await this.client.close();
            }
            const dbUrl: string = this._settings.mongoDBLocalUrl;
            const newClient = new MongoClient(dbUrl, {
                retryReads: true,
                connectTimeoutMS: 10_000,
                serverSelectionTimeoutMS: 5_000,
                maxIdleTimeMS: 60_000,
                maxPoolSize: 80,
            });
            this.db = newClient.db('DB');
            this.client = newClient;
            this.inventoryAdapter = null;
        }

        try {
            const reconnect = this.setupClient.bind(this);
            this.featureServices = bootFeaturesSync({db: this.db!, redis: this.cartRedis, reconnect});
            this.auditService = (this.featureServices.audit as AuditService) ?? this.auditService;
            await bootFeaturesAsync({db: this.db!, redis: this.cartRedis, services: this.featureServices, reconnect});
        } catch (err) {
            log.error({scope: 'feature.boot', err}, 'feature registry boot failed');
        }
    }

    // Delegate UserService methods
    async setupAdmin() { return this.userService.setupAdmin(); }
    async addUser({ user }: { user: any }) { return this.userService.addUser({ user }); }
    async updateUser({ user }: { user: any }) { return this.userService.updateUser({ user }); }
    async removeUser({ id }: { id: string }) { return this.userService.removeUser({ id }); }
    async getUser({ email }: { email: string }) { return this.userService.getUser({ email }); }
    async getUsers() { return this.userService.getUsers(); }

    // Customer-auth surface — owned by the `customerAuth` feature
    // (split out of `users` 2026-05-02). The Proxy in `authz.ts` injects
    // `_session.email` for customer-scoped methods so the service can
    // scope every Mongo query by the authenticated customer rather than
    // a client-supplied id. When the `customerAuth` plug-and-play flag is
    // off the service is undefined; delegates return a "feature disabled"
    // envelope so the public sign-up surface fails closed instead of
    // crashing.
    private customerAuthOrFail<T>(fn: (svc: import('@services/features/CustomerAuth/CustomerAuthService').CustomerAuthService) => Promise<T>, fallback: string): Promise<T | string> {
        const svc = this.customerAuthService;
        if (!svc) return Promise.resolve(JSON.stringify({error: 'customer accounts are disabled on this site'}) as unknown as T);
        return fn(svc).catch(() => JSON.stringify({error: fallback}) as unknown as T);
    }
    async signUpCustomer({customer}: {customer: any}) {
        return this.customerAuthOrFail(svc => svc.signUpCustomer({user: customer}), 'signUpCustomer failed');
    }
    async addCustomerFromGoogle(args: {email: string; name?: string; googleSub: string}) {
        return this.customerAuthOrFail(svc => svc.addCustomerFromGoogle(args), 'addCustomerFromGoogle failed');
    }
    async getMe(args: {_session?: {email?: string}; email?: string} = {}) {
        const svc = this.customerAuthService;
        if (!svc) return undefined;
        return svc.getMe(args);
    }
    async updateMyProfile({customer, _session}: {customer: any; _session?: {email?: string}}) {
        return this.customerAuthOrFail(svc => svc.updateMyProfile({user: customer, _session}), 'updateMyProfile failed');
    }
    async changeMyPassword(args: {oldPassword: string; newPassword: string; _session?: {email?: string}}) {
        return this.customerAuthOrFail(svc => svc.changeMyPassword(args), 'changeMyPassword failed');
    }
    async saveMyAddress(args: {address: any; _session?: {email?: string}}) {
        return this.customerAuthOrFail(svc => svc.saveMyAddress(args), 'saveMyAddress failed');
    }
    async deleteMyAddress(args: {id: string; _session?: {email?: string}}) {
        return this.customerAuthOrFail(svc => svc.deleteMyAddress(args), 'deleteMyAddress failed');
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
        } catch (err) { log.error({scope: 'audit.deleteLanguage', err, symbol: language?.symbol}, 'audit deleteLanguage failed'); }
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
            } catch (err) { log.error({scope: 'audit.section.addUpdate', err}, 'audit addUpdateSectionItem failed'); }
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
        } catch (err) { log.error({scope: 'audit.section.remove', err, sectionId: id}, 'audit removeSectionItem failed'); }
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
            log.error({scope: 'publish.snapshot', err}, 'publishSnapshot failed');
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async getPublishedHistory({limit}: {limit?: number} = {}): Promise<string> {
        try {
            return JSON.stringify(await this.publishService.getHistory(limit ?? 50));
        } catch (err) {
            log.error({scope: 'publish.history', err}, 'getPublishedHistory failed');
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
            log.error({scope: 'publish.getSnapshot', err}, 'getPublishedSnapshot failed');
            return null;
        }
    }

    async getThemes(): Promise<string> {
        try { return JSON.stringify(await this.themeService.getThemes()); }
        catch (err) { log.error({scope: 'theme.list', err}, 'getThemes failed'); return '[]'; }
    }
    async getActiveTheme(): Promise<string | null> {
        try {
            const t = await this.themeService.getActive();
            return t ? JSON.stringify(t) : null;
        } catch (err) { log.error({scope: 'theme.getActive', err}, 'getActiveTheme failed'); return null; }
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
        catch (err) { log.error({scope: 'posts.list', err}, 'getPosts failed'); return '[]'; }
    }
    async getPost({slug, includeDrafts}: {slug: string; includeDrafts?: boolean}): Promise<string | null> {
        try {
            const post = await this.postService.getBySlug(slug, {includeDrafts});
            return post ? JSON.stringify(post) : null;
        } catch (err) { log.error({scope: 'posts.get', err, slug}, 'getPost failed'); return null; }
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
        catch (err) { log.error({scope: 'products.list', err}, 'getProducts failed'); return '[]'; }
    }
    async getProduct({slug, includeDrafts}: {slug: string; includeDrafts?: boolean}): Promise<string | null> {
        try {
            const product = await this.productService.getBySlug(slug, {includeDrafts});
            return product ? JSON.stringify(product) : null;
        } catch (err) { log.error({scope: 'products.get', err, slug}, 'getProduct failed'); return null; }
    }
    async searchProducts({q, limit, includeDrafts}: {q: string; limit?: number; includeDrafts?: boolean}): Promise<string> {
        try { return JSON.stringify(await this.productService.search(q, {limit, includeDrafts})); }
        catch (err) { log.error({scope: 'products.search', err, q}, 'searchProducts failed'); return '[]'; }
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
        catch (err) { log.error({scope: 'footer.get', err}, 'getFooter failed'); return JSON.stringify({enabled: true, columns: [], bottom: ''}); }
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
        catch (err) { log.error({scope: 'siteFlags.get', err}, 'getSiteFlags failed'); return JSON.stringify({blogEnabled: true}); }
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
        catch (err) { log.error({scope: 'siteSeo.get', err}, 'getSiteSeo failed'); return '{}'; }
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
        catch (err) { log.error({scope: 'translationMeta.get', err}, 'getTranslationMeta failed'); return JSON.stringify({value: {}, version: 0}); }
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
            log.error({scope: 'audit.getLog', err}, 'getAuditLog failed');
            return JSON.stringify({rows: [], total: 0, error: String(err)});
        }
    }
    async getAuditCollections(): Promise<string> {
        try { return JSON.stringify(await this.auditService.listCollections()); }
        catch (err) { log.error({scope: 'audit.collections', err}, 'getAuditCollections failed'); return '[]'; }
    }
    async getAuditActors(): Promise<string> {
        try { return JSON.stringify(await this.auditService.listActors()); }
        catch (err) { log.error({scope: 'audit.actors', err}, 'getAuditActors failed'); return '[]'; }
    }

    async getErrorLog({source, level, scope, sinceISO, limit}: {source?: string; level?: string; scope?: string; sinceISO?: string; limit?: number}): Promise<string> {
        try {
            const rows = await this.errorLogService.list({
                source: (source === 'client' || source === 'admin' || source === 'server' || source === 'mcp') ? source : undefined,
                level: (level === 'error' || level === 'warn') ? level : undefined,
                scope,
                sinceISO,
                limit,
            });
            return JSON.stringify({rows, total: rows.length});
        } catch (err) {
            log.error({scope: 'errorLog.get', err}, 'getErrorLog failed');
            return JSON.stringify({rows: [], total: 0, error: String(err)});
        }
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
            log.error({scope: 'publish.getMeta', err}, 'getPublishedMeta failed');
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
     *  Cached after first resolution; cleared by `saveAdapterConfig`.
     *  Public so the Inventory manifest's `services` factory can wire
     *  this in as the adapter thunk handed to InventoryService. */
    public resolveInventoryAdapter(): IWarehouseAdapter {
        if (this.inventoryAdapter) return this.inventoryAdapter;
        // Env var first — ops-managed secrets beat self-service writes.
        const envCfg = (process.env.INVENTORY_ADAPTER_CONFIG || '').trim();
        if (envCfg) {
            try {
                const parsed = JSON.parse(envCfg) as IAdapterConfig;
                this.inventoryAdapter = createAdapter(parsed);
                return this.inventoryAdapter;
            } catch (err) {
                log.error({scope: 'inventory.adapterEnvConfig', err}, 'INVENTORY_ADAPTER_CONFIG parse failed');
            }
        }
        // Lazy-load from settings asynchronously; first call falls back to
        // mock and a follow-up settles cache once the DB read completes.
        if (this.inventoryService) {
            void this.inventoryService.readAdapterConfigRaw().then(cfg => {
                if (cfg) {
                    try { this.inventoryAdapter = createAdapter(cfg); }
                    catch (err) { log.error({scope: 'inventory.adapterRebuild', err}, 'adapter rebuild failed'); }
                }
            }).catch(err => log.error({scope: 'inventory.adapterRead', err}, 'adapter read failed'));
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
        } catch (err) { log.error({scope: 'orders.myOrder', err, id}, 'myOrder failed'); return null; }
    }

    async orderByToken({token, cookieToken}: {token: string; cookieToken?: string | null}): Promise<string | null> {
        try {
            const order = await this.orderService.getByToken(token, cookieToken ?? null);
            return order ? JSON.stringify(order) : null;
        } catch (err) { log.error({scope: 'orders.byToken', err}, 'orderByToken failed'); return null; }
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
        } catch (err) { log.error({scope: 'orders.admin.get', err, id}, 'adminOrder failed'); return null; }
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

    /**
     * Plug-and-play feature flags — runtime view of which manifests are
     * active, mirroring exactly what the registry sees at boot. The admin
     * `FeatureFlagsPanel` reads this; v1 is read-only — flips need an env
     * var + restart. `envKey` is derived from the manifest id (camelCase →
     * `FEATURE_<UPPER_SNAKE>`).
     */
    async getFeatureFlags(): Promise<string> {
        try {
            const {featureRegistry, resolveEnabled} = await import('@services/infra/featureRegistry');
            const {envKeyForFeature, hasMongoOverride} = await import('@services/infra/featureFlags');
            const rows = featureRegistry.map(f => ({
                id: f.id,
                displayName: f.displayName,
                enabled: resolveEnabled(f),
                coreInfrastructure: !!f.coreInfrastructure,
                requires: f.requires ?? [],
                envKey: envKeyForFeature(f.id),
                envSet: process.env[envKeyForFeature(f.id)] !== undefined,
                mongoOverride: hasMongoOverride(f.id),
            }));
            return JSON.stringify(rows);
        } catch (err) {
            log.error({scope: 'feature.flags.list', err}, 'getFeatureFlags failed');
            return '[]';
        }
    }

    /**
     * Persist a feature-flag override. Validates id against the
     * registry, refreshes the in-process cache so subsequent
     * `isFeatureEnabled` reads reflect the new value, returns the
     * persisted row as JSON.
     */
    async setFeatureFlag({id, enabled, _session}: {id: string; enabled: boolean; _session?: {email?: string}}): Promise<string> {
        return runMutation(
            'setFeatureFlag',
            async () => {
                const {featureRegistry} = await import('@services/infra/featureRegistry');
                if (!featureRegistry.some(f => f.id === id)) {
                    throw new Error(`unknown feature id: ${id}`);
                }
                const row = await this.featureFlagsService.set(id, enabled, _session?.email);
                // Refresh the cache so isFeatureEnabled() picks up the
                // new override on the next call (route gates etc).
                const {primeFeatureFlagCache} = await import('@services/infra/featureFlags');
                const all = await this.featureFlagsService.listAll();
                primeFeatureFlagCache(all);
                return row;
            },
            {collection: 'FeatureFlags', op: 'update', actor: {email: _session?.email}, tag: id},
        );
    }

    /** Drop an override row — feature falls back to default + env behaviour. */
    async clearFeatureFlag({id, _session}: {id: string; _session?: {email?: string}}): Promise<string> {
        return runMutation(
            'clearFeatureFlag',
            async () => {
                await this.featureFlagsService.clear(id);
                const {primeFeatureFlagCache} = await import('@services/infra/featureFlags');
                const all = await this.featureFlagsService.listAll();
                primeFeatureFlagCache(all);
                return {id, cleared: true};
            },
            {collection: 'FeatureFlags', op: 'delete', actor: {email: _session?.email}, tag: id},
        );
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