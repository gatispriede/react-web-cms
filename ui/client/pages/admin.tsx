import React from 'react'
import {SessionProvider} from "next-auth/react"
import LoginBtn from "@admin/features/Auth/login-btn";
import {Session} from "next-auth";
import {GetServerSideProps} from "next";
import {getServerSession} from "next-auth/next";
import {adminAuthOptions as authOptions} from "./api/auth/authOptions";
import {serverSideTranslations} from "next-i18next/pages/serverSideTranslations";

const Admin = ({session}: { session: Session }) => {
    // Phase 1.A auth-split: admin auth lives under /api/admin/auth/*.
    // SessionProvider's default `basePath` is `/api/auth` (customer
    // instance) — without overriding, `useSession()` refetches from the
    // wrong base and always returns null for admin users. Pinning
    // `basePath` here keeps client-side session reads coherent with the
    // admin cookie + admin signin form.
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