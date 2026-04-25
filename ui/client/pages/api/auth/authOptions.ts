import _GoogleProvider from "next-auth/providers/google";
import _CredentialsProvider from 'next-auth/providers/credentials';
// ESM/CJS interop: tsx may wrap CJS default exports under .default
const GoogleProvider: typeof _GoogleProvider = (_GoogleProvider as any).default ?? _GoogleProvider;
const CredentialsProvider: typeof _CredentialsProvider = (_CredentialsProvider as any).default ?? _CredentialsProvider;
import { compare } from "bcrypt";
import {NextAuthOptions, User} from "next-auth";
import MongoApi from "@services/api/client/MongoApi";
import {clientIp, rateLimit} from "../_rateLimit";
import {checkLockout, formatWait, lockoutKey, recordFailure, recordSuccess} from "../_loginLockout";

const mongoApi = new MongoApi()

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
                clientId: process.env.AUTH_GOOGLE_ID,
                clientSecret: process.env.AUTH_GOOGLE_SECRET,
            })]
            : []),
        CredentialsProvider({
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
                const rl = rateLimit(`signin:${ip}`, 5, 60_000);
                if (!rl.ok) {
                    throw new Error('Too many sign-in attempts, try again in a minute');
                }

                // Per-(ip,email) progressive lockout — 10s → 1m → 5m → 15m → 30m.
                // Sits BEFORE the bcrypt compare so a locked attacker doesn't even
                // burn CPU. See `_loginLockout.ts` for the schedule + invariants.
                const lockKey = lockoutKey(ip, credentials.email);
                // Helper — appends a machine-readable `[retryMs=N]` marker so
                // the custom sign-in page can parse the wait duration and run a
                // live countdown without round-tripping. Humans see the prose;
                // the UI strips the marker before display.
                const fail = (msg: string, retryAfterMs: number) =>
                    new Error(`${msg} [retryMs=${retryAfterMs}]`);

                const lock = checkLockout(lockKey);
                if (!lock.ok) {
                    throw fail(`Too many wrong attempts. Try again in ${formatWait(lock.retryAfterMs)}.`, lock.retryAfterMs);
                }

                const user = await mongoApi.getUser({email: credentials.email})

                if (!user || !user.password) {
                    // Treat unknown email same as wrong password — both feed the
                    // same lockout bucket, otherwise an attacker can use the timing
                    // (or the lack of a lockout message) to enumerate valid emails.
                    const f = recordFailure(lockKey);
                    throw fail(`Wrong email or password. Try again in ${formatWait(f.retryAfterMs)}.`, f.retryAfterMs);
                }
                const isPasswordValid = await compare(
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
                    role: (user as any).role ?? 'viewer',
                    canPublishProduction: Boolean((user as any).canPublishProduction),
                    mustChangePassword: Boolean((user as any).mustChangePassword),
                    preferredAdminLocale: (user as any).preferredAdminLocale,
                } as any;
            },
        }),
    ],
    callbacks: {
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
                const u = user as unknown as User & {role?: string; canPublishProduction?: boolean; mustChangePassword?: boolean; preferredAdminLocale?: 'en' | 'lv'}
                return {
                    ...token,
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.role ?? (token as any).role ?? 'viewer',
                    canPublishProduction: u.canPublishProduction ?? (token as any).canPublishProduction ?? false,
                    mustChangePassword: u.mustChangePassword ?? (token as any).mustChangePassword ?? false,
                    preferredAdminLocale: u.preferredAdminLocale ?? (token as any).preferredAdminLocale,
                }
            }

            return token
        },
        session: ({session, token}) => {
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.id,
                    name: token.name,
                    email: token.email,
                    role: (token as any).role ?? 'viewer',
                    canPublishProduction: Boolean((token as any).canPublishProduction),
                    mustChangePassword: Boolean((token as any).mustChangePassword),
                    preferredAdminLocale: (token as any).preferredAdminLocale,
                }
            }
        },
    },
};
