import {getServerSession} from 'next-auth/next';
import type {NextAuthOptions} from 'next-auth';
import {UserRole} from '@interfaces/IUser';
import {composedAuthz} from '@services/infra/featureRegistry';

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
 *
 * Phase C.3: every entry now lives on a feature manifest's
 * `authz.sessionInjected`. The merge block at the bottom of this file
 * populates the Set at module load. Kept as `Set<string>` (not Readonly)
 * so the merge can `.add(...)`.
 */
export const SESSION_INJECTED_METHODS: ReadonlySet<string> = new Set<string>();

/**
 * Customer-only mutations / queries — the Proxy stamps `_session.email`
 * (and `_session.customerId`) so the service can scope every Mongo query
 * by the authenticated customer rather than a client-supplied id. This is
 * the IDOR guard.
 *
 * Phase C.3: customer entries are mirrored on the Users + Orders manifests
 * (`authz.customerSessionInjected`). The single non-manifest entry —
 * `placeOrder` — has no feature owner (no service implements it; appears
 * to be a legacy alias kept for safety) and stays here as a platform-level
 * residual.
 */
export const CUSTOMER_SESSION_INJECTED_METHODS: ReadonlySet<string> = new Set<string>([
    // Platform residual — no manifest owner; legacy alias.
    'placeOrder',
]);

export const CUSTOMER_MUTATION_REQUIREMENTS: Record<string, true> = {
    // Platform residual — no manifest owner; legacy alias. See above.
    placeOrder: true,
};

export const CUSTOMER_QUERY_REQUIREMENTS: Record<string, true> = {};

/**
 * `signUpCustomer` is the **only** customer mutation reachable without a
 * session (anonymous → customer). It's still routed through `guardMethods`
 * (so the Proxy can no-op the session injection) but doesn't appear in the
 * customer requirements table — the resolver layer applies the rate-limit.
 *
 * Phase C.3: Users manifest contributes `signUpCustomer`; Orders manifest
 * contributes the six guest-checkout mutations. The merge block at the
 * bottom of this file populates the Set at module load.
 */
const ANON_OPEN_MUTATIONS: ReadonlySet<string> = new Set<string>();

/**
 * Per-method resource-scoped extractor — pulls `{scope, resourceId}` out
 * of the call args. Returning `null` skips the check (e.g. for
 * create-flow methods where there's no existing resource).
 * Per `docs/features/platform/edit-levels.md`.
 */
export type ResourceGateExtractor = (args: any) => {scope: 'page' | 'module' | 'element'; resourceId: string} | null;

/** Async predicate the proxy calls after the role/capability check passes. */
export type PermissionCheck = (opts: {
    userId: string;
    userRole: UserRole;
    scope: 'page' | 'module' | 'element';
    resourceId: string;
}) => Promise<boolean>;

export function guardMethods<T extends object>(
    target: T,
    session: GraphqlSession,
    required: Record<string, UserRole | true>,
    capabilities: Record<string, Capability> = {},
    resourceGated: Record<string, ResourceGateExtractor> = {},
    permissionCheck?: PermissionCheck,
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

            // Resource-scoped gate (per `docs/features/platform/edit-levels.md`).
            // Decision 1: admins bypass — predicate short-circuits at the
            // PermissionService layer, so we still call through (and let
            // the service take credit for the bypass) but only when an
            // extractor is registered AND a check function is wired.
            const resourceExtractor = resourceGated[key];
            if (resourceExtractor && permissionCheck) {
                const bound = value.bind(obj);
                return async (args: any = {}) => {
                    const grant = resourceExtractor(args);
                    if (grant) {
                        const ok = await permissionCheck({
                            userId: session.email ?? '',
                            userRole: session.role,
                            scope: grant.scope,
                            resourceId: grant.resourceId,
                        });
                        if (!ok) {
                            throw new AuthzError(`Forbidden: no ${grant.scope} grant on ${grant.resourceId}`);
                        }
                    }
                    if (SESSION_INJECTED_METHODS.has(key)) {
                        return bound({...args, _session: session});
                    }
                    return bound(args);
                };
            }

            if (SESSION_INJECTED_METHODS.has(key)) {
                const bound = value.bind(obj);
                return (args: any = {}) => bound({...args, _session: session});
            }
            return value.bind(obj);
        },
    });
}

/**
 * Phase C.3: capability predicates are built dynamically from each
 * manifest's `authz.capabilities` mapping (Publishing contributes
 * `publishSnapshot` / `rollbackToSnapshot` → `canPublishProduction`).
 * The merge block at the bottom of this file populates this object.
 */
export const MUTATION_CAPABILITIES: Record<string, Capability> = {};

/**
 * Phase C.3: every entry lives on a feature manifest's
 * `authz.mutationRequirements`. The merge block at the bottom of this
 * file populates this object at module load — keeping the same shape
 * means call sites (`MUTATION_REQUIREMENTS[key]`) keep working.
 */
export const MUTATION_REQUIREMENTS: Record<string, UserRole> = {};

/**
 * Phase C.3: every entry lives on a feature manifest's
 * `authz.queryRequirements`. The merge block at the bottom of this
 * file populates this object at module load.
 */
export const QUERY_REQUIREMENTS: Record<string, UserRole> = {};

/**
 * Edit-levels (2026-05-02) — per-method resource extractors composed from
 * every active feature manifest's `authz.resourceGated`. Empty by default;
 * features opt in by adding entries to their manifest. The
 * `graphqlResolvers.ts` mutation route reads here and feeds the proxy.
 */
export const RESOURCE_GATED_METHODS: Record<string, ResourceGateExtractor> = {};

// ──────────────────────────────────────────────────────────────────────
// Phase C.1 — fold per-manifest authz contributions into the legacy
// constants above. `composedAuthz()` walks every active feature
// manifest's `authz` block and merges them; we apply the result HERE
// so existing call sites (`MUTATION_REQUIREMENTS[key]`,
// `SESSION_INJECTED_METHODS.has(key)`, …) keep working unchanged. Phase
// C.2 then moves individual entries OUT of the literals above INTO
// each feature's manifest. Once a feature's authz lives entirely in
// its manifest, dropping the feature from the registry — via a
// `FEATURE_<X>=false` env or by deleting the folder — also drops its
// authz contributions in the same step.
//
// Lazy require so the registry's transitive imports (every manifest →
// every service) don't cycle through this file during module load.
// ──────────────────────────────────────────────────────────────────────
try {
    const merged = composedAuthz();
    Object.assign(MUTATION_REQUIREMENTS, merged.mutationRequirements);
    Object.assign(QUERY_REQUIREMENTS, merged.queryRequirements);
    for (const [k, v] of Object.entries(merged.capabilities)) {
        // Capability contributions land as `'canPublishProduction'` /
        // `'canEditUsers'` strings on the manifest; the legacy table
        // expects predicate functions. Bridge by lookup at call time.
        const flag = v;
        MUTATION_CAPABILITIES[k] = (s: GraphqlSession) =>
            (s as unknown as Record<string, unknown>)[flag] ? true : `${flag} required`;
    }
    for (const m of merged.sessionInjected) (SESSION_INJECTED_METHODS as Set<string>).add(m);
    for (const m of merged.customerSessionInjected) (CUSTOMER_SESSION_INJECTED_METHODS as Set<string>).add(m);
    for (const m of merged.customerMutations) {
        (CUSTOMER_MUTATION_REQUIREMENTS as Record<string, true>)[m] = true;
    }
    for (const m of merged.customerQueries) {
        (CUSTOMER_QUERY_REQUIREMENTS as Record<string, true>)[m] = true;
    }
    for (const m of merged.anonOpenMutations) (ANON_OPEN_MUTATIONS as Set<string>).add(m);
    Object.assign(RESOURCE_GATED_METHODS, merged.resourceGated);
} catch (err) {
    // Logger may not be initialised yet at module-eval time; fall
    // through silently — manifest-side authz simply won't apply,
    // but the legacy tables above still gate correctly.
    // eslint-disable-next-line no-console
    console.warn('[authz] failed to merge composedAuthz contributions:', err);
}
