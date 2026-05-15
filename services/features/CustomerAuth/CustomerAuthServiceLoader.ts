import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {CustomerAuthService} from './CustomerAuthService';
import {isFeatureEnabled} from '@services/infra/featureFlags';

/**
 * CustomerAuth Loader — split out of `Users` (decision 2026-05-02).
 *
 * Customer-grade methods (sign-up, profile, password, addresses,
 * Google linking) live here as a separate top-level feature; admin user
 * methods stay in `users`. Sharing the `Users` collection keeps the
 * single-row-per-human invariant; the `kind` discriminator already
 * separates the two domains at the data layer.
 *
 * Default enabled — most installs run customer-facing surfaces. Operators
 * can flip it off through `/admin/system/features` to ship an
 * admin-only / staff-only CMS without the public sign-up surface.
 */
export class CustomerAuthServiceLoader extends ServiceLoader {
    readonly id = 'customerAuth';
    readonly displayName = 'Customer accounts';

    /**
     * Default ON — explicit so the runtime/admin UI surfaces a clear
     * default-state stamp. Reads through the standard env > Mongo > default
     * resolution.
     */
    readonly enabled = (): boolean => isFeatureEnabled(this.id);

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        const hashSaltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
        // W6c — magic-link token store. Sibling collection so a stray
        // `Users` query never trips over a token row.
        const magicTokensDB = ctx.db.collection('CustomerMagicTokens');
        // Best-effort TTL — Mongo will sweep consumed/expired rows.
        void magicTokensDB.createIndex({expiresAt: 1}, {expireAfterSeconds: 0}).catch(() => {});
        void magicTokensDB.createIndex({tokenHash: 1}, {unique: true}).catch(() => {});
        void magicTokensDB.createIndex({email: 1, createdAt: -1}).catch(() => {});
        return {
            customerAuth: new CustomerAuthService(
                ctx.db.collection('Users'),
                hashSaltRounds,
                magicTokensDB,
            ),
        };
    }

    readonly schemaSDL = `extend type QueryMongo {
    me: ICustomer
}
extend type MutationMongo {
    signUpCustomer(customer: InUser!): String!
    updateMyProfile(customer: InUser!): String!
    changeMyPassword(oldPassword: String!, newPassword: String!): String!
    saveMyAddress(address: InAddress!): String!
    deleteMyAddress(id: String!): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        customerMutations: [
            'updateMyProfile',
            'changeMyPassword',
            'saveMyAddress',
            'deleteMyAddress',
        ],
        customerQueries: [
            'getMe',
        ],
        // Customer-side `_session` injection — IDOR guard. The Proxy
        // stamps `_session.email` + `_session.customerId` onto every
        // call so the service scopes by the authenticated customer
        // instead of trusting client-supplied ids.
        customerSessionInjected: [
            'getMe',
            'updateMyProfile',
            'changeMyPassword',
            'saveMyAddress',
            'deleteMyAddress',
        ],
        anonOpenMutations: [
            'signUpCustomer',
        ],
    };
}
