import NextAuth from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from "bcrypt";
import {NextAuthOptions, User} from "next-auth";
import MongoApi from "../../../api/MongoApi";

const mongoApi = new MongoApi()

export const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
    },
    providers: [
        GoogleProvider({
            clientId: process.env.AUTH_GOOGLE_ID || "",
            clientSecret: process.env.AUTH_GOOGLE_SECRET || ""
        }),
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
            async authorize(credentials) {
                if (!credentials) {
                    return null;
                }

                if (!credentials?.email || !credentials.password) {
                    return null
                }

                const user = await mongoApi.getUser({email: credentials.email})

                if (!user) {
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
                }
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
                    avatarUrl: session.user.avatarUrl || token.avatarUrl,
                }
            }

            if(user) {
                const u = user as unknown as User
                return {
                    ...token,
                    id: u.id,
                    name: u.name,
                    email: u.email
                }
            }

            return token
        },
        session: ({session, token, user}) => {
            // console.log('Session Callback', { session, token })
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.id,
                    name: token.name,
                    email: token.email,
                }
            }

        },
    },
};

export default NextAuth(authOptions);