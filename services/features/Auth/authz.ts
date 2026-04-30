import {getServerSession} from 'next-auth/next';
import type {NextAuthOptions} from 'next-auth';
import {UserRole} from '@interfaces/IUser';

export const ROLE_RANK: Record<UserRole, number> = {viewer: 0, editor: 1, admin: 2};

export type SessionKind = 'admin' | 'customer' | 'anonymous';

export interface GraphqlSession {
    /**
     * Discriminator across the two auth populations. Defaults to 'admin'
     * for legacy callers that built their `GraphqlSession` literal without
     * setting it, so existing standalone server code keeps working.
     */
    kind?: SessionKind;
    role: UserRole;
    email?: string;
    /** Populated when `kind === 'customer'` — convenience handle so
     *  resolvers don't have to re-derive it from `email`. */
    customerId?: string;
    canPublishProduction?: boolean;
}

// Layering note: `authOptions` lives in the frontend tree (next to the NextAuth
// page route it configures). Callers pass it in so Server code never imports
// across the layer boundary.
export async function sessionFromReq(req: any, res: any, authOptions: NextAuthOptions): Promise<GraphqlSession> {
    try {
        const session = await getServerSession(req, res, authOptions);
        const user = session?.user as any;
        if (!user) {
            return {kind: 'anonymous', role: 'viewer'};
        }
        const kind: SessionKind = (user.kind ?? 'admin') as SessionKind;
        if (kind === 'customer') {
            return {
                kind: 'customer',
                role: 'viewer',
                email: user.email,
                customerId: user.id,
            };
        }
        return {
            kind: 'admin',
            role: (user.role ?? 'viewer') as UserRole,
            email: user.email,
            canPublishProduction: Boolean(user.canPublishProduction),
        };
    } catch {
        return {kind: 'anonymous', role: 'viewer'};
    }
}

export class AuthzError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthzError';
    }
}

export function assertRole(session: GraphqlSession, minimum: UserRole) {
    if (ROLE_RANK[session.role] < ROLE_RANK[minimum]) {
        throw new AuthzError(`Forbidden: ${minimum} role required (current: ${session.role})`);
    }
}

export type Capability = (session: GraphqlSession) => boolean | string;

/**
 * Methods listed here receive the caller's session (email) merged into their
 * first argument as `_session`. Services read `args._session?.email` to stamp
 * audit fields like `publishedBy`/`editedBy`. The underlying service methods
 * keep their original signatures — the Proxy injects the session; standalone
 * server callers (which don't have sessions) just don't pass `_session` and
 * the services fall back to `undefined`.
 */
export const SESSION_INJECTED_METHODS: ReadonlySet<string> = new Set([
    // Publish/rollback — stamps `publishedBy` on the snapshot doc.
    'publishSnapshot',
    'rollbackToSnapshot',
    // Content edits — stamps `editedBy` + `editedAt` on the touched doc.
    'addUpdateSectionItem',
    'updateNavigation',
    'replaceUpdateNavigation',
    'addUpdateNavigationItem',
    'deleteNavigationItem',
    'removeSectionItem',
    // Theme / Post / Site-settings editors.
    'saveTheme',
    'deleteTheme',
    'setActiveTheme',
    'resetPreset',
    'savePost',
    'deletePost',
    'setPostPublished',
    'saveProduct',
    'deleteProduct',
    'setProductPublished',
    'saveFooter',
    'saveSiteFlags',
    'saveSiteSeo',
    'saveTranslationMeta',
    'saveLogo',
    'addUpdateLanguage',
    'deleteLanguage',
    // Inventory mutations — stamps `editedBy` on the InventoryRuns /
    // SiteSettings docs the service writes.
    'inventorySyncAll',
    'inventorySyncDelta',
    'inventorySaveAdapterConfig',
    // Orders — admin transitions stamp the actor's email into
    // `statusHistory[].by`.
    'adminTransitionOrder',
    'adminRefundOrder',
    // MCP token issuance / revocation — stamps `createdBy` on the token doc.
    'mcpIssueToken',
    'mcpRevokeToken',
]);

/**
 * Customer-only mutations / queries — the Proxy stamps `_session.email`
 * (and `_session.customerId`) so the service can scope every Mongo query
 * by the authenticated customer rather than a client-supplied id. This is
 * the IDOR guard.
 */
export const CUSTOMER_SESSION_INJECTED_METHODS: ReadonlySet<string> = new Set([
    'getMe',
    'updateMyProfile',
    'changeMyPassword',
    'saveMyAddress',
    'deleteMyAddress',
    'placeOrder',
    // Orders module — every method that scopes by customer is injected
    // so the resolver layer never has to re-derive `customerId` from
    // client-supplied args.
    'myOrders',
    'myOrder',
    'createDraftOrder',
    'attachOrderAddress',
    'attachOrderShipping',
    'authorizeOrderPayment',
    'finalizeOrder',
    'cancelOrder',
]);

export const CUSTOMER_MUTATION_REQUIREMENTS: Record<string, true> = {
    updateMyProfile: true,
    changeMyPassword: true,
    saveMyAddress: true,
    deleteMyAddress: true,
    placeOrder: true,
    // Orders — checkout-flow mutations. Listed here so customer sessions
    // can call them; anonymous sessions reach the same methods through
    // `ANON_OPEN_MUTATIONS` (gated at the resolver by `siteFlags.allowGuestCheckout`).
    createDraftOrder: true,
    attachOrderAddress: true,
    attachOrderShipping: true,
    authorizeOrderPayment: true,
    finalizeOrder: true,
    cancelOrder: true,
};

export const CUSTOMER_QUERY_REQUIREMENTS: Record<string, true> = {
    getMe: true,
    myOrders: true,
    myOrder: true,
};

/**
 * `signUpCustomer` is the **only** customer mutation reachable without a
 * session (anonymous → customer). It's still routed through `guardMethods`
 * (so the Proxy can no-op the session injection) but doesn't appear in the
 * customer requirements table — the resolver layer applies the rate-limit.
 */
const ANON_OPEN_MUTATIONS: ReadonlySet<string> = new Set([
    'signUpCustomer',
    // Guest-checkout flow. Reachability is policy: when
    // `siteFlags.allowGuestCheckout` is off, the resolver layer rejects
    // before the service is hit. Authz here just unblocks the Proxy.
    'createDraftOrder',
    'attachOrderAddress',
    'attachOrderShipping',
    'authorizeOrderPayment',
    'finalizeOrder',
    'cancelOrder',
]);

export function guardMethods<T extends object>(
    target: T,
    session: GraphqlSession,
    required: Record<string, UserRole | true>,
    capabilities: Record<string, Capability> = {},
): T {
    const kind: SessionKind = session.kind ?? 'admin';

    return new Proxy(target, {
        get(obj, prop: string | symbol, receiver) {
            const value = Reflect.get(obj, prop, receiver);
            if (typeof value !== 'function') return value;
            const key = String(prop);

            // ---------------------------------------------------------
            // Branch 1: customer session. Customer endpoints are gated
            // by the parallel CUSTOMER_*_REQUIREMENTS tables; the admin
            // `required` table is never satisfied by a customer cookie.
            // ---------------------------------------------------------
            if (kind === 'customer') {
                const isCustomerMutation = CUSTOMER_MUTATION_REQUIREMENTS[key] === true;
                const isCustomerQuery = CUSTOMER_QUERY_REQUIREMENTS[key] === true;
                if (isCustomerMutation || isCustomerQuery) {
                    if (CUSTOMER_SESSION_INJECTED_METHODS.has(key)) {
                        const bound = value.bind(obj);
                        return (args: any = {}) => bound({...args, _session: session});
                    }
                    return value.bind(obj);
                }
                // Not a customer endpoint — but anon-open mutations
                // (signUpCustomer) are also reachable from a customer
                // session, even though there's no reason to. Allow it.
                if (ANON_OPEN_MUTATIONS.has(key)) {
                    return value.bind(obj);
                }
                // Anything else listed in the admin `required` table is
                // off-limits — explicitly reject so the customer can't
                // call admin mutations even if they hand-craft a query.
                if (required[key] !== undefined) {
                    return () => {
                        throw new AuthzError(`Forbidden: customer endpoint (cannot call admin ${key})`);
                    };
                }
                // Fall-through methods (e.g. unrestricted reads like
                // `getSections` / `getLogo`) stay open.
                return value.bind(obj);
            }

            // ---------------------------------------------------------
            // Branch 2: anonymous session. Only the anon-open mutations
            // are reachable; customer-only endpoints are not (they need
            // a customer cookie); admin endpoints obviously are not.
            // ---------------------------------------------------------
            if (kind === 'anonymous') {
                if (ANON_OPEN_MUTATIONS.has(key)) {
                    // Inject `_session` for the order checkout-flow
                    // methods so the service can apply guest-vs-customer
                    // IDOR checks based on the session kind.
                    if (CUSTOMER_SESSION_INJECTED_METHODS.has(key)) {
                        const bound = value.bind(obj);
                        return (args: any = {}) => bound({...args, _session: session});
                    }
                    return value.bind(obj);
                }
                if (CUSTOMER_MUTATION_REQUIREMENTS[key] === true || CUSTOMER_QUERY_REQUIREMENTS[key] === true) {
                    return () => {
                        throw new AuthzError(`Forbidden: customer endpoint requires sign-in (${key})`);
                    };
                }
                // Fall through to the admin role check — anonymous has
                // role 'viewer', so admin-gated methods reject below.
            }

            // ---------------------------------------------------------
            // Branch 3: admin session (or anonymous fall-through). Use
            // the admin `required` + `capabilities` tables exactly as
            // before. Admin sessions calling customer-only endpoints
            // are explicitly rejected — admins are not customers.
            // ---------------------------------------------------------
            if (kind === 'admin') {
                if (CUSTOMER_MUTATION_REQUIREMENTS[key] === true || CUSTOMER_QUERY_REQUIREMENTS[key] === true) {
                    return () => {
                        throw new AuthzError(`Forbidden: customer-only endpoint (admin cannot call ${key})`);
                    };
                }
            }

            const requirement = required[key];
            // The customer entries in `required` (when callers merge
            // tables) are `true` rather than a UserRole — only admin
            // role checks apply here.
            if (typeof requirement === 'string') {
                const minimum = requirement;
                if (ROLE_RANK[session.role] < ROLE_RANK[minimum]) {
                    return () => {
                        throw new AuthzError(`Forbidden: ${minimum} role required for ${key} (current: ${session.role})`);
                    };
                }
            }
            const capability = capabilities[key];
            if (capability) {
                const result = capability(session);
                if (result !== true) {
                    return () => {
                        throw new AuthzError(typeof result === 'string' ? result : `Forbidden: capability check failed for ${key}`);
                    };
                }
            }
            if (SESSION_INJECTED_METHODS.has(key)) {
                const bound = value.bind(obj);
                return (args: any = {}) => bound({...args, _session: session});
            }
            return value.bind(obj);
        },
    });
}

export const MUTATION_CAPABILITIES: Record<string, Capability> = {
    publishSnapshot: (s) => s.canPublishProduction ? true : 'canPublishProduction required to publish',
    rollbackToSnapshot: (s) => s.canPublishProduction ? true : 'canPublishProduction required to rollback',
};

export const MUTATION_REQUIREMENTS: Record<string, UserRole> = {
    createNavigation: 'editor',
    addUpdateNavigationItem: 'editor',
    updateNavigation: 'editor',
    replaceUpdateNavigation: 'editor',
    addUpdateSectionItem: 'editor',
    removeSectionItem: 'editor',
    deleteNavigationItem: 'editor',
    saveImage: 'editor',
    deleteImage: 'editor',
    saveLogo: 'editor',
    addUpdateLanguage: 'editor',
    deleteLanguage: 'editor',
    addUser: 'admin',
    updateUser: 'admin',
    removeUser: 'admin',
    publishSnapshot: 'editor',
    rollbackToSnapshot: 'editor',
    saveTheme: 'editor',
    deleteTheme: 'editor',
    setActiveTheme: 'editor',
    resetPreset: 'editor',
    savePost: 'editor',
    deletePost: 'editor',
    setPostPublished: 'editor',
    saveProduct: 'admin',
    deleteProduct: 'admin',
    setProductPublished: 'admin',
    saveFooter: 'editor',
    saveSiteFlags: 'admin',
    saveSiteSeo: 'editor',
    saveTranslationMeta: 'editor',
    // Inventory mutations — admin-only (touches Products + SiteSettings).
    inventorySyncAll: 'admin',
    inventorySyncDelta: 'admin',
    inventorySaveAdapterConfig: 'admin',
    // Orders — admin transitions / refunds. Refunds are admin-only;
    // standard transitions (mark fulfilling/shipped/delivered/cancel)
    // are editor-grade so warehouse staff can drive the queue.
    adminTransitionOrder: 'editor',
    adminRefundOrder: 'admin',
    // MCP token CRUD — admin-only (token grants delegated admin access).
    mcpIssueToken: 'admin',
    mcpRevokeToken: 'admin',
};

export const QUERY_REQUIREMENTS: Record<string, UserRole> = {
    getUsers: 'admin',
    setupAdmin: 'admin',
    getMongoDBUri: 'admin',
    loadData: 'admin',
    // Audit log is admin-only — diffs can include user text and actor
    // metadata we don't want exposing to editors.
    getAuditLog: 'admin',
    getAuditCollections: 'admin',
    getAuditActors: 'admin',
    // Inventory reads — admin-only. Status leaks adapter id + last error
    // text; dead-letters can include external system identifiers we
    // shouldn't expose to editors.
    inventoryStatus: 'admin',
    inventoryReadDeadLetters: 'admin',
    // Orders — admin reads. Editor sees the queue; refunds need admin.
    adminOrders: 'editor',
    adminOrder: 'editor',
    shippingMethodsFor: 'editor',
    // MCP token list — admin-only.
    mcpListTokens: 'admin',
};
