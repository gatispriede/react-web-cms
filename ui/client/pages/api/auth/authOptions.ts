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
        // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-eval
        const nodeRequire = eval('require') as NodeJS.Require;
        cached = nodeRequire('bcrypt').compare;
        return cached!;
    };
})();
import {NextAuthOptions, User} from "next-auth";
import MongoApi from "@services/api/client/MongoApi";
import {clientIp, rateLimit} from "../_rateLimit";
import {checkLockout, formatWait, lockoutKey, recordFailure, recordSuccess} from "../_loginLockout";
import {COOKIE_NAME as CART_COOKIE_NAME, getCartCookieSecrets, verifyCartId} from "@services/features/Cart/cartCookie";
// `mongoDBConnection` is server-only (drags fs, mongo, nodemailer into any
// graph that statically references it). The signIn callback below resolves
// it via `eval('require')` so the bundler can't trace the import — keeps
// the customer-facing pages-tree (`/account/*`, `/auth/signin`) free of
// server-only code.

const mongoApi = new MongoApi()

// `MongoApi.getUser` is a thin wrapper that GQty-resolves to the GraphQL
// `getUser` query. The customer providers below call MongoApi directly to
// keep the same query path; the customer/admin filter is then applied
// in-memory (the GraphQL `getUser` returns the raw user doc — see UserApi).

const fail = (msg: string, retryAfterMs: number) =>
    new Error(`${msg} [retryMs=${retryAfterMs}]`);

export const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
    },
    // Custom signin page renders a live countdown when the lockout fires —
    // it parses the `[retryMs=N]` marker that the `fail()` helper below
    // appends to wrong-password / lockout errors. The default NextAuth
    // signin page can't do that.
    pages: {
        signIn: '/auth/signin',
    },
    providers: [
        ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
            ? [GoogleProvider({
                id: 'admin-google',
                name: 'Admin Google',
                clientId: process.env.AUTH_GOOGLE_ID,
                clientSecret: process.env.AUTH_GOOGLE_SECRET,
            })]
            : []),
        CredentialsProvider({
            id: 'admin-credentials',
            name: "Sign in",
            credentials: {
                email: {
                    label: "Email",
                    type: "email",
                    placeholder: "example@example.com",
                },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, req) {
                if (!credentials) {
                    return null;
                }

                if (!credentials?.email || !credentials.password) {
                    return null
                }

                const ip = clientIp(req as any);
                // 5 attempts per minute per IP — bcrypt.compare is CPU-bound, so this also blunts login DoS.
                // Smoke tests run many sign-ins per worker per minute; bump
                // the per-IP cap when running under E2E so legit test admin
                // creates aren't 429'd out. Production keeps 5/min.
                const rl = rateLimit(`signin:${ip}`, (process.env.E2E_RUN || process.env.NODE_ENV !== 'production') ? 1000 : 5, 60_000);
                if (!rl.ok) {
                    throw new Error('Too many sign-in attempts, try again in a minute');
                }

                // Per-(ip,email,kind) progressive lockout — admin and customer
                // buckets are independent so a customer hammering the customer
                // form doesn't lock the admin out of /auth/signin.
                const lockKey = lockoutKey(ip, credentials.email + ':admin');

                const lock = checkLockout(lockKey);
                if (!lock.ok) {
                    throw fail(`Too many wrong attempts. Try again in ${formatWait(lock.retryAfterMs)}.`, lock.retryAfterMs);
                }

                const user = await mongoApi.getUser({email: credentials.email})

                // Reject customers using the admin form. Treat absent `kind`
                // as admin (legacy back-compat — every legacy doc is admin).
                const userKind = (user as any)?.kind;
                if (!user || !user.password || (userKind === 'customer')) {
                    // Treat unknown email same as wrong password — both feed the
                    // same lockout bucket, otherwise an attacker can use the timing
                    // (or the lack of a lockout message) to enumerate valid emails.
                    const f = recordFailure(lockKey);
                    throw fail(`Wrong email or password. Try again in ${formatWait(f.retryAfterMs)}.`, f.retryAfterMs);
                }
                const isPasswordValid = await getBcryptCompare()(
                    credentials.password,
                    user.password
                )

                if (!isPasswordValid) {
                    const f = recordFailure(lockKey);
                    throw fail(`Wrong email or password. Try again in ${formatWait(f.retryAfterMs)}.`, f.retryAfterMs);
                }

                // Successful auth — clear the bucket so a one-typo operator
                // doesn't carry a 1-minute lockout into their next session.
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
        }),
        CredentialsProvider({
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
                if (!rl.ok) {
                    throw new Error('Too many sign-in attempts, try again in a minute');
                }
                const lockKey = lockoutKey(ip, credentials.email + ':customer');
                const lock = checkLockout(lockKey);
                if (!lock.ok) {
                    throw fail(`Too many wrong attempts. Try again in ${formatWait(lock.retryAfterMs)}.`, lock.retryAfterMs);
                }

                const user = await mongoApi.getUser({email: credentials.email});
                // Reject admin docs using the customer form. Absent `kind`
                // is admin (legacy back-compat) so this also blocks them.
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
                // DECISION: capture the guest cart cookie at authorize-time so
                // the signIn callback can merge it. The signIn callback does
                // not receive `req`, so this is the only place we can read
                // request cookies for the credentials path. Google sign-in
                // does not get this — see signIn callback note.
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
        }),
        ...(process.env.AUTH_CUSTOMER_GOOGLE_ID && process.env.AUTH_CUSTOMER_GOOGLE_SECRET
            ? [GoogleProvider({
                id: 'customer-google',
                name: 'Customer Google',
                clientId: process.env.AUTH_CUSTOMER_GOOGLE_ID,
                clientSecret: process.env.AUTH_CUSTOMER_GOOGLE_SECRET,
            })]
            : []),
    ],
    callbacks: {
        signIn: async ({user, account, profile}) => {
            // Admin Google: must already exist as an admin. Customers
            // signing up via Google: link or create on first touch.
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
                // DECISION: customer-google sign-in does not have access to
                // the request cookie jar in this callback (the redirect
                // round-trips through Google), so the guest cart merge is
                // not wired here in v1. The credentials path covers the
                // most common case. A follow-up can attach a server-side
                // post-redirect handler that reads the cookie and calls
                // `mergeGuestIntoCustomer`.
            }
            // Cart-merge for customer-credentials sign-in. Non-blocking:
            // any failure is logged but the sign-in still succeeds.
            const cartId = (user as any)?._cartId as string | null | undefined;
            const customerId = (user as any)?.id as string | undefined;
            if (account?.provider === 'customer-credentials' && cartId && customerId) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-eval
                    const nodeRequire = eval('require') as NodeJS.Require;
                    const {getMongoConnection} = nodeRequire('@services/infra/mongoDBConnection');
                    await getMongoConnection().cartMergeGuestIntoCustomer(cartId, customerId);
                } catch (err) {
                    console.error('[cart] mergeGuestIntoCustomer on signIn failed:', err);
                }
            }
            return true;
        },
        jwt: ({token, user, session, trigger}) => {
            if (trigger === 'update' && session?.user) {
                return {
                    ...token,
                    name: session.user.name || token.name,
                    email: session.user.email || token.email,
                    avatarUrl: session.user.avatarUrl || (token as any).avatarUrl,
                    role: (session.user as any).role || (token as any).role,
                    canPublishProduction: (session.user as any).canPublishProduction ?? (token as any).canPublishProduction,
                    mustChangePassword: (session.user as any).mustChangePassword ?? (token as any).mustChangePassword,
                    preferredAdminLocale: (session.user as any).preferredAdminLocale ?? (token as any).preferredAdminLocale,
                }
            }

            if(user) {
                const u = user as unknown as User & {kind?: 'admin' | 'customer'; role?: string; canPublishProduction?: boolean; mustChangePassword?: boolean; preferredAdminLocale?: 'en' | 'lv'}
                const kind = u.kind ?? (token as any).kind ?? 'admin';
                if (kind === 'customer') {
                    return {
                        ...token,
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        kind: 'customer',
                        // Strip admin-only carryovers — a customer JWT must
                        // never accidentally carry an editor/admin role.
                        role: undefined,
                        canPublishProduction: undefined,
                        mustChangePassword: undefined,
                        preferredAdminLocale: undefined,
                    };
                }
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
                }
            }

            return token
        },
        session: ({session, token}) => {
            const kind = ((token as any).kind ?? 'admin') as 'admin' | 'customer';
            if (kind === 'customer') {
                return {
                    ...session,
                    user: {
                        ...session.user,
                        id: token.id,
                        name: token.name,
                        email: token.email,
                        kind: 'customer',
                        role: undefined,
                    },
                } as any;
            }
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.id,
                    name: token.name,
                    email: token.email,
                    kind: 'admin',
                    role: (token as any).role ?? 'viewer',
                    canPublishProduction: Boolean((token as any).canPublishProduction),
                    mustChangePassword: Boolean((token as any).mustChangePassword),
                    preferredAdminLocale: (token as any).preferredAdminLocale,
                }
            }
        },
    },
};
