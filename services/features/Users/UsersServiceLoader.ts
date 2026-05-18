import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {UserService} from './UserService';
import {log} from '@services/infra/logger';

/**
 * Users Loader — Class Loader L3 migration of `usersFeature`.
 *
 * Owns `UserService` (Users collection — admin + customer accounts).
 * Reads four env-driven knobs for the first-run admin seed:
 * `ADMIN_USERNAME`, `ADMIN_DEFAULT_PASSWORD`, `ADMIN_PASSWORD_HASH`,
 * `BCRYPT_ROUNDS`. Co-located here since this is the only consumer.
 *
 * `onBoot` runs the admin-seed flow. Re-entry guard is a Promise-based
 * singleton (App Router compat — B2 of app-router-migration): under
 * Pages Router a bool flag was safe because boot ran serially during
 * `_app`'s initial-props chain. Under App Router, `app/layout.tsx`
 * reads Mongo per request via `getMongoConnection()` and any reconnect
 * path can re-trigger `bootFeaturesAsync` → `onBoot` concurrently.
 * A bool has a TOCTOU race across the `await` inside `setupAdmin()` —
 * two callers can both observe `false`, both flip it `true`, and both
 * insert the admin user. Storing the in-flight Promise instead means
 * the second caller awaits the first's work. Cleared on failure so the
 * next boot retries.
 *
 * NOTE: CustomerAuth split (per ROADMAP service-modularity backlog) is
 * a follow-up — `signUpCustomer` / `updateMyProfile` / `changeMyPassword`
 * / `saveMyAddress` / `deleteMyAddress` / `getMe` move to a sibling
 * `CustomerAuthServiceLoader` after L3 wraps.
 */

let seedingPromise: Promise<void> | null = null;

export class UsersServiceLoader extends ServiceLoader {
    readonly id = 'users';
    readonly displayName = 'Users';
    readonly coreInfrastructure = true;

    /**
     * Customer-side SDL + authz (`me` / `signUpCustomer` /
     * `updateMyProfile` / `changeMyPassword` / `saveMyAddress` /
     * `deleteMyAddress`) moved to the sibling `CustomerAuthServiceLoader`
     * (decision 2026-05-02). UsersServiceLoader is admin-grade only.
     */
    readonly schemaSDL = `extend type QueryMongo {
    setupAdmin: IUser
    getUser(email: String): IUser
    getUsers: [IUser!]!
    """Resolved admin UI mode for the calling session. Per-user setting wins; falls back to siteFlags.defaultAdminUiMode then 'advanced'."""
    myAdminUiMode: String!
}
extend type MutationMongo {
    addUser(user: InUser!): String!
    updateUser(user: InUser!): String!
    removeUser(id: String!, idempotencyKey: String): String!
    """Editor or admin self-service — flip own admin UI mode."""
    setMyAdminUiMode(mode: String!): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        mutationRequirements: {
            addUser: 'admin',
            updateUser: 'admin',
            removeUser: 'admin',
            // Self-service — any signed-in admin/editor can flip their own mode.
            setMyAdminUiMode: 'editor',
        },
        queryRequirements: {
            getUsers: 'admin',
            setupAdmin: 'admin',
            myAdminUiMode: 'editor',
        },
        sessionInjected: [
            'setMyAdminUiMode',
            'myAdminUiMode',
        ],
        // Q10 — `addUser`/`updateUser`/`removeUser` are admin-rank already;
        // feature gate is a forward-compat hook for a future `user-manager`
        // functional role. `setMyAdminUiMode` is intentionally NOT gated —
        // it's self-service over the caller's own row.
        resourceGated: {
            addUser: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Users'},
            }),
            updateUser: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Users'},
            }),
            removeUser: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Users'},
            }),
        },
    };

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        const adminName = process.env.ADMIN_USERNAME ?? 'Admin';
        const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD ?? '';
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH ?? '';
        const hashSaltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
        return {
            users: new UserService(
                ctx.db.collection('Users'),
                ctx.reconnect,
                adminName,
                adminPassword,
                adminPasswordHash,
                hashSaltRounds,
            ),
        };
    }

    async onBoot(ctx: FeatureContext): Promise<void> {
        if (seedingPromise) return seedingPromise;
        const users = ctx.services.users as UserService | undefined;
        if (!users) return;
        seedingPromise = (async () => {
            try {
                const admin = await users.setupAdmin();
                if (admin) {
                    // Was a bare `console.log` before — that wrote raw text to
                    // stdout, which corrupted the MCP stdio JSON-RPC stream.
                    // Going through the structured logger respects MCP_STDIO=1
                    // (stdio.ts sets that before this loader runs) and routes
                    // the line to stderr.
                    log.info({scope: 'auth.bootstrap', email: admin.email}, 'admin user ready');
                }
            } catch (err) {
                // Null out so the next boot retries — a stuck rejected
                // promise would permanently disable admin seeding for the
                // process lifetime on a transient Mongo blip.
                seedingPromise = null;
                log.error({scope: 'auth.bootstrap', err}, 'admin seed failed');
            }
        })();
        return seedingPromise;
    }
}

/** Test-only escape hatch — reset the in-flight admin-seed singleton. */
export function _resetAdminSeededForTest(): void {
    seedingPromise = null;
}
