import NextAuth from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from "bcrypt";
import {NextAuthOptions, User} from "next-auth";
import MongoApi from "../../../api/MongoApi";
import {clientIp, rateLimit} from "../_rateLimit";

const mongoApi = new MongoApi()

export const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
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

                const user = await mongoApi.getUser({email: credentials.email})

                if (!user || !user.password) {
                    return null
                }
                const isPasswordValid = await compare(
                    credentials.password,
                    user.password
                )

                if (!isPasswordValid) {
                    return null
                }

                return {
                    id: user.id + '',
                    email: user.email,
                    name: user.name,
                    password: user.password,
                    role: (user as any).role ?? 'viewer',
                    canPublishProduction: Boolean((user as any).canPublishProduction),
                    mustChangePassword: Boolean((user as any).mustChangePassword),
                } as any;
            },
        }),
    ],
    callbacks: {
        jwt: ({token, user, session, trigger}) => {
            // console.log('JWT Callback', { token, user })
            // console.log('JWT Callback', { token, user, trigger, session });

            if (trigger === 'update' && session?.user) {
                return {
                    ...token,
                    name: session.user.name || token.name,
                    email: session.user.email || token.email,
                    avatarUrl: session.user.avatarUrl || (token as any).avatarUrl,
                    role: (session.user as any).role || (token as any).role,
                    canPublishProduction: (session.user as any).canPublishProduction ?? (token as any).canPublishProduction,
                    mustChangePassword: (session.user as any).mustChangePassword ?? (token as any).mustChangePassword,
                }
            }

            if(user) {
                const u = user as unknown as User & {role?: string; canPublishProduction?: boolean; mustChangePassword?: boolean}
                return {
                    ...token,
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.role ?? (token as any).role ?? 'viewer',
                    canPublishProduction: u.canPublishProduction ?? (token as any).canPublishProduction ?? false,
                    mustChangePassword: u.mustChangePassword ?? (token as any).mustChangePassword ?? false,
                }
            }

            return token
        },
        session: ({session, token, user}) => {
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
                }
            }

        },
    },
};

export default NextAuth(authOptions);