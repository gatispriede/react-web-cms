import React from 'react'
import {SessionProvider} from "next-auth/react"
import LoginBtn from "@admin/features/Auth/login-btn";
import {Session} from "next-auth";
import {GetServerSideProps} from "next";
import {getServerSession} from "next-auth/next";
import {adminAuthOptions as authOptions} from "./api/auth/authOptions";
import {serverSideTranslations} from "next-i18next/pages/serverSideTranslations";

const Admin = ({session}: { session: Session }) => {
    // basePath pins this provider to the admin NextAuth instance —
    // /api/admin/auth/* — so useSession() / signIn() inside the admin
    // chrome don't fall through to the customer /api/auth/* surface
    // and bounce to /account/signin. See auth-split-client-admin
    // (Phase 1.A) + the parallel guard in _app.tsx.
    return (
        <SessionProvider session={session} basePath="/api/admin/auth">
            <LoginBtn/>
        </SessionProvider>
    )
}

export const getServerSideProps: GetServerSideProps = async ({req, res, locale}) => {
    const raw = await getServerSession(req, res, authOptions);
    const session = raw ? JSON.parse(JSON.stringify(raw)) : null;
    return {
        props: {
            session,
            ...(await serverSideTranslations(locale ?? 'en', ['common', 'app'])),
        },
    };
};

export default Admin;