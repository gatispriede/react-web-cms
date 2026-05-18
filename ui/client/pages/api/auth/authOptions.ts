import _GoogleProvider from "next-auth/providers/google";
import _CredentialsProvider from 'next-auth/providers/credentials';
// ESM/CJS interop: tsx may wrap CJS default exports under .default
const GoogleProvider: typeof _GoogleProvider = (_GoogleProvider as any).default ?? _GoogleProvider;
const CredentialsProvider: typeof _CredentialsProvider = (_CredentialsProvider as any).default ?? _CredentialsProvider;
// `bcrypt` ships a native binary via node-gyp-build → `fs`/`path`. Static
// import would leak into any browser bundle that statically references
// authOptions (most importantly `_session.ts` in the pages-tree). The
// resolver below uses an eval'd require so the bundler can't trace it.
const getBcryptCompare = (() => {
    let cached: ((plain: string, hash: string) => Promise<boolean>) | null = null;
    return () => {
        if (cached) return cached;

        const nodeRequire = eval('require') as NodeJS.Require;
        cached = nodeRequire('bcrypt').compare;
        return cached!;
    };
})();
import {NextAuthOptions, User} from "next-auth";
import MongoApi from "@services/api/client/MongoApi";
import {clientIp, rateLimit} from "@client/lib/api-helpers/rateLimit";
import {checkLockout, formatWait, lockoutKey, recordFailure, recordSuccess} from "@client/lib/api-helpers/loginLockout";
import {COOKIE_NAME as CART_COOKIE_NAME, getCartCookieSecrets, verifyCartId} from "@services/features/Cart/cartCookie";

/**
 * NextAuth options — split into two named exports (Phase 1.A —
 * `auth-split-client-admin`):
 *
 *  - `adminAuthOptions` — admin-credentials + admin-google. Cookie
 *    `cms.admin-session`, `Path=/admin`. Mounted by
 *    `ui/client/pages/api/admin/auth/[...nextauth].ts`.
 *  - `customerAuthOptions` — customer-credentials, customer-google,
 *    customer-magic, customer-facebook, customer-apple. Cookie
 *    `cms.customer-session`, `Path=/`. Mounted by
 *    `ui/client/pages/api/auth/[...nextauth].ts`.
 *
 * Each instance:
 *   - publishes its own provider list (admin never sees customer
 *     providers and vice versa)
 *   - sets a disjoint session-token cookie name + path so a customer
 *     login does not overwrite an admin session in the same browser
 *   - branches the `jwt` / `session` callback on the resolved `kind`
 *     and strips cross-kind fields so an admin JWT can never carry
 *     customer-only state and vice versa
 *
 * Back-compat: the legacy `authOptions` export is kept (= the
 * customer instance) so any older `getServerSession(req, res,
 * authOptions)` call site keeps compiling during migration. New
 * code should import the explicit `customerAuthOptions` /
 * `adminAuthOptions` instead.
 *
 * Cookie migration (W6c — old shared `next-auth.session-token`):
 *   any pre-split session is treated as expired the next time the
 *   user lands on a protected route. Customers re-auth via
 *   magic-link (cheap), admins re-auth via credentials.
 */

const mongoApi = new MongoApi();

const fail = (msg: string, retryAfterMs: number) =>
    new Error(`${msg} [retryMs=${retryAfterMs}]`);

// ----------------------------------------------------------------------
// Providers
// ----------------------------------------------------------------------

const adminCredentialsProvider = CredentialsProvider({
    id: 'admin-credentials',
    name: "Sign in",
    credentials: {
        email: {label: "Email", type: "email", placeholder: "example@example.com"},
        password: {label: "Password", type: "password"},
    },
    async authorize(credentials, req) {
        if (!credentials || !credentials?.email || !credentials.password) return null;

        const ip = clientIp(req as any);
        const rl = rateLimit(`signin:${ip}`, (process.env.E2E_RUN || process.env.NODE_ENV !== 'production') ? 1000 : 5, 60_000);
        if (!rl.ok) throw new Error('Too many sign-in attempts, try again in a minute');

        const lockKey = lockoutKey(ip, credentials.email + ':admin');
        const lock = checkLockout(lockKey);
        if (!lock.ok) throw fail(`Too many wrong attempts. Try again in ${formatWait(lock.retryAfterMs)}.`, lock.retryAfterMs);

        const user = await mongoApi.getUser({email: credentials.email});
        const userKind = (user as any)?.kind;
        if (!user || !user.password || (userKind === 'customer')) {
            const f = recordFailure(lockKey);
            throw fail(`Wrong email or password. Try again in ${formatWait(f.retryAfterMs)}.`, f.retryAfterMs);
        }
        const isPasswordValid = await getBcryptCompare()(credentials.password, user.password);
        if (!isPasswordValid) {
            const f = recordFailure(lockKey);
            throw fail(`Wrong email or password. Try again in ${formatWait(f.retryAfterMs)}.`, f.retryAfterMs);
        }
        recordSuccess(lockKey);
        return {
            id: user.id + '',
            email: user.email,
            name: user.name,
            password: user.password,
            kind: 'admin',
            role: (user as any).role ?? 'viewer',
            canPublishProduction: Boolean((user as any).canPublishProduction),
            mustChangePassword: Boolean((user as any).mustChangePassword),
            preferredAdminLocale: (user as any).preferredAdminLocale,
        } as any;
    },
});

const adminGoogleProviders = process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [GoogleProvider({
        id: 'admin-google',
        name: 'Admin Google',
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })]
    : [];

const customerCredentialsProvider = CredentialsProvider({
    id: 'customer-credentials',
    name: 'Customer sign in',
    credentials: {
        email: {label: 'Email', type: 'email'},
        password: {label: 'Password', type: 'password'},
    },
    async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) return null;

        const ip = clientIp(req as any);
        const rl = rateLimit(`signin-customer:${ip}`, (process.env.E2E_RUN || process.env.NODE_ENV !== 'production') ? 1000 : 5, 60_000);
        if (!rl.ok) throw new Error('Too many sign-in attempts, try again in a minute');

        const lockKey = lockoutKey(ip, credentials.email + ':customer');
        const lock = checkLockout(lockKey);
        if (!lock.ok) throw fail(`Too many wrong attempts. Try again in ${formatWait(lock.retryAfterMs)}.`, lock.retryAfterMs);

        const user = await mongoApi.getUser({email: credentials.email});
        const userKind = (user as any)?.kind;
        if (!user || !user.password || userKind !== 'customer') {
            const f = recordFailure(lockKey);
            throw fail(`Wrong email or password. Try again in ${formatWait(f.retryAfterMs)}.`, f.retryAfterMs);
        }
        const ok = await getBcryptCompare()(credentials.password, user.password);
        if (!ok) {
            const f = recordFailure(lockKey);
            throw fail(`Wrong email or password. Try again in ${formatWait(f.retryAfterMs)}.`, f.retryAfterMs);
        }
        recordSuccess(lockKey);
        let _cartId: string | null = null;
        try {
            const raw = (req as any)?.cookies?.[CART_COOKIE_NAME] as string | undefined;
            if (raw) _cartId = verifyCartId(raw, getCartCookieSecrets());
        } catch { /* missing secret env in dev — ignore */ }
        return {
            id: user.id + '',
            email: user.email,
            name: user.name,
            kind: 'customer',
            _cartId,
        } as any;
    },
});

const customerGoogleProviders = process.env.AUTH_CUSTOMER_GOOGLE_ID && process.env.AUTH_CUSTOMER_GOOGLE_SECRET
    ? [GoogleProvider({
        id: 'customer-google',
        name: 'Customer Google',
        clientId: process.env.AUTH_CUSTOMER_GOOGLE_ID,
        clientSecret: process.env.AUTH_CUSTOMER_GOOGLE_SECRET,
    })]
    : [];

const customerMagicProvider = CredentialsProvider({
    id: 'customer-magic',
    name: 'Magic link',
    credentials: {token: {label: 'Magic token', type: 'text'}},
    async authorize(credentials) {
        if (!credentials?.token) return null;
        try {
            const nodeRequire = eval('require') as NodeJS.Require;
            const {getMongoConnection} = nodeRequire('@services/infra/mongoDBConnection');
            const conn = getMongoConnection();
            const svc = (conn as any).featureServices?.customerAuth;
            if (!svc?.redeemMagicLinkToken) return null;
            const result = await svc.redeemMagicLinkToken({token: String(credentials.token)});
            if (!result.ok || !result.userId) return null;
            return {id: result.userId, email: result.email, name: result.name, kind: 'customer'} as any;
        } catch (err) {
            console.error('[customer-magic] authorize failed:', err);
            return null;
        }
    },
});

const customerFacebookProviders = (process.env.FACEBOOK_OAUTH_ENABLED === 'true' && process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET)
    ? [(() => {
        const nodeRequire = eval('require') as NodeJS.Require;
        const FB = nodeRequire('next-auth/providers/facebook');
        const FacebookProvider = (FB as any).default ?? FB;
        return FacebookProvider({
            id: 'customer-facebook',
            name: 'Facebook',
            clientId: process.env.AUTH_FACEBOOK_ID,
            clientSecret: process.env.AUTH_FACEBOOK_SECRET,
        });
    })()]
    : [];

const customerAppleProviders = (process.env.APPLE_OAUTH_ENABLED === 'true' && process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET)
    ? [(() => {
        const nodeRequire = eval('require') as NodeJS.Require;
        const AP = nodeRequire('next-auth/providers/apple');
        const AppleProvider = (AP as any).default ?? AP;
        return AppleProvider({
            id: 'customer-apple',
            name: 'Apple',
            clientId: process.env.AUTH_APPLE_ID,
            clientSecret: process.env.AUTH_APPLE_SECRET,
        });
    })()]
    : [];

// ----------------------------------------------------------------------
// Callbacks — admin and customer use disjoint trees so cross-kind
// fields can never leak across the boundary.
// ----------------------------------------------------------------------

const adminCallbacks: NextAuthOptions['callbacks'] = {
    signIn: async ({user, account, profile}) => {
        if (account?.provider === 'admin-google') {
            const email = (user.email || (profile as any)?.email || '').toString();
            if (!email) return false;
            const existing = await mongoApi.getUser({email});
            const kind = (existing as any)?.kind;
            if (!existing || (kind === 'customer')) return false;
            (user as any).kind = 'admin';
            (user as any).role = (existing as any).role ?? 'viewer';
            (user as any).id = (existing as any).id;
            (user as any).canPublishProduction = Boolean((existing as any).canPublishProduction);
            (user as any).mustChangePassword = Boolean((existing as any).mustChangePassword);
            (user as any).preferredAdminLocale = (existing as any).preferredAdminLocale;
            return true;
        }
        // admin-credentials returns its `user` object from authorize() —
        // we don't need to recheck the database here. Anything else is
        // rejected.
        return account?.provider === 'admin-credentials';
    },
    jwt: ({token, user, session, trigger}) => {
        if (trigger === 'update' && session?.user) {
            return {
                ...token,
                name: session.user.name || token.name,
                email: session.user.email || token.email,
                avatarUrl: (session.user as any).avatarUrl || (token as any).avatarUrl,
                role: (session.user as any).role || (token as any).role,
                canPublishProduction: (session.user as any).canPublishProduction ?? (token as any).canPublishProduction,
                mustChangePassword: (session.user as any).mustChangePassword ?? (token as any).mustChangePassword,
                preferredAdminLocale: (session.user as any).preferredAdminLocale ?? (token as any).preferredAdminLocale,
            };
        }
        if (user) {
            const u = user as unknown as User & {
                role?: string; canPublishProduction?: boolean;
                mustChangePassword?: boolean; preferredAdminLocale?: 'en' | 'lv';
            };
            return {
                ...token,
                id: u.id,
                name: u.name,
                email: u.email,
                kind: 'admin',
                role: u.role ?? (token as any).role ?? 'viewer',
                canPublishProduction: u.canPublishProduction ?? (token as any).canPublishProduction ?? false,
                mustChangePassword: u.mustChangePassword ?? (token as any).mustChangePassword ?? false,
                preferredAdminLocale: u.preferredAdminLocale ?? (token as any).preferredAdminLocale,
            };
        }
        return token;
    },
    session: ({session, token}) => ({
        ...session,
        user: {
            ...session.user,
            id: (token as any).id,
            name: token.name,
            email: token.email,
            kind: 'admin',
            role: (token as any).role ?? 'viewer',
            canPublishProduction: Boolean((token as any).canPublishProduction),
            mustChangePassword: Boolean((token as any).mustChangePassword),
            preferredAdminLocale: (token as any).preferredAdminLocale,
        },
    } as any),
};

const customerCallbacks: NextAuthOptions['callbacks'] = {
    signIn: async ({user, account, profile}) => {
        if (account?.provider === 'customer-magic') {
            (user as any).kind = 'customer';
            return true;
        }
        if (account?.provider === 'customer-facebook' || account?.provider === 'customer-apple') {
            const email = (user.email || (profile as any)?.email || '').toString();
            const sub = (account.providerAccountId || (profile as any)?.sub || '').toString();
            if (!email || !sub) return false;
            const link = await mongoApi.addCustomerFromGoogle({email, name: user.name ?? undefined, googleSub: `${account.provider}:${sub}`});
            if (link.error) return false;
            let id = link.id;
            if (!id) {
                const existing = await mongoApi.getUser({email});
                if (!existing || (existing as any).kind !== 'customer') return false;
                id = (existing as any).id;
            }
            (user as any).kind = 'customer';
            (user as any).id = id;
            return true;
        }
        if (account?.provider === 'customer-google') {
            const email = (user.email || (profile as any)?.email || '').toString();
            const sub = (account.providerAccountId || (profile as any)?.sub || '').toString();
            if (!email || !sub) return false;
            const link = await mongoApi.addCustomerFromGoogle({email, name: user.name ?? undefined, googleSub: sub});
            if (link.error) return false;
            let id = link.id;
            if (!id) {
                const existing = await mongoApi.getUser({email});
                if (!existing || (existing as any).kind !== 'customer') return false;
                id = (existing as any).id;
            }
            (user as any).kind = 'customer';
            (user as any).id = id;
        }
        const cartId = (user as any)?._cartId as string | null | undefined;
        const customerId = (user as any)?.id as string | undefined;
        if (account?.provider === 'customer-credentials' && cartId && customerId) {
            try {
                const nodeRequire = eval('require') as NodeJS.Require;
                const {getMongoConnection} = nodeRequire('@services/infra/mongoDBConnection');
                await getMongoConnection().cartMergeGuestIntoCustomer(cartId, customerId);
            } catch (err) {
                console.error('[cart] mergeGuestIntoCustomer on signIn failed:', err);
            }
        }
        // Reject any leakage of admin providers onto the customer instance.
        if (account?.provider && account.provider.startsWith('admin-')) return false;
        return true;
    },
    jwt: ({token, user, session, trigger}) => {
        if (trigger === 'update' && session?.user) {
            return {
                ...token,
                name: session.user.name || token.name,
                email: session.user.email || token.email,
                avatarUrl: (session.user as any).avatarUrl || (token as any).avatarUrl,
                // customerType is a forward-compat field set later by
                // `client-account-settings`; pass through if present.
                customerType: (session.user as any).customerType ?? (token as any).customerType,
                notificationPrefsHash: (session.user as any).notificationPrefsHash ?? (token as any).notificationPrefsHash,
            };
        }
        if (user) {
            const u = user as unknown as User & {customerType?: string};
            return {
                ...token,
                id: u.id,
                name: u.name,
                email: u.email,
                kind: 'customer',
                customerType: u.customerType,
                // Strip admin-only carryovers — defence in depth.
                role: undefined,
                canPublishProduction: undefined,
                mustChangePassword: undefined,
                preferredAdminLocale: undefined,
            };
        }
        return token;
    },
    session: ({session, token}) => ({
        ...session,
        user: {
            ...session.user,
            id: (token as any).id,
            name: token.name,
            email: token.email,
            kind: 'customer',
            customerType: (token as any).customerType,
            notificationPrefsHash: (token as any).notificationPrefsHash,
            // Defence-in-depth: strip admin-only fields from the response.
            role: undefined,
        },
    } as any),
};

// ----------------------------------------------------------------------
// Exported configurations
// ----------------------------------------------------------------------

const ADMIN_COOKIE_NAME = 'cms.admin-session';
const CUSTOMER_COOKIE_NAME = 'cms.customer-session';
const isProd = process.env.NODE_ENV === 'production';

/** Admin NextAuth config — credentials + Google OAuth only. */
export const adminAuthOptions: NextAuthOptions = {
    session: {strategy: 'jwt'},
    pages: {signIn: '/admin/signin'},
    providers: [...adminGoogleProviders, adminCredentialsProvider],
    callbacks: adminCallbacks,
    cookies: {
        sessionToken: {
            name: ADMIN_COOKIE_NAME,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                // Path must be `/` — the cookie has to ride along on
                // `/api/admin/auth/session` (path `/api/...`, not `/admin/...`)
                // for `useSession()` to read it. Cookie *paths* are prefix
                // matches against the request URL path; `/admin` would NOT
                // match `/api/admin/auth/*`. Storefront isolation is by
                // cookie *name* (`cms.admin-session` vs `cms.customer-session`),
                // not by path.
                path: '/',
                secure: isProd,
            },
        },
    },
};

/** Customer NextAuth config — magic-link primary, optional credentials
 *  + Google / Facebook / Apple OAuth. */
export const customerAuthOptions: NextAuthOptions = {
    session: {strategy: 'jwt'},
    pages: {signIn: '/account/signin'},
    providers: [
        customerCredentialsProvider,
        customerMagicProvider,
        ...customerGoogleProviders,
        ...customerFacebookProviders,
        ...customerAppleProviders,
    ],
    callbacks: customerCallbacks,
    cookies: {
        sessionToken: {
            name: CUSTOMER_COOKIE_NAME,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                // Customer cookie spans all storefront paths that need
                // the session (account / checkout / orders). Using `/`
                // is acceptable because the cookie name is distinct
                // from the admin cookie and the admin route tree
                // explicitly checks the admin cookie.
                path: '/',
                secure: isProd,
            },
        },
    },
};

/**
 * Legacy export — points at the customer instance so any pre-split
 * `getServerSession(req, res, authOptions)` call site keeps compiling.
 * New code should import the explicit `customerAuthOptions` /
 * `adminAuthOptions` named exports.
 *
 * @deprecated since auth-split-client-admin (Phase 1.A). Prefer the
 * explicit named exports.
 */
export const authOptions: NextAuthOptions = customerAuthOptions;

// Next.js 16 requires a default export for every file in pages/api/.
// This is a shared config module, not a route handler.
import type {NextApiRequest, NextApiResponse} from 'next';
export default function _noop(_req: NextApiRequest, res: NextApiResponse) { res.status(404).end(); }
