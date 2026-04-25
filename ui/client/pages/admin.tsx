import React from 'react'
import {SessionProvider} from "next-auth/react"
import LoginBtn from "@admin/features/Auth/login-btn";
import {Session} from "next-auth";
import {GetServerSideProps} from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "./api/auth/[...nextauth]";
import {serverSideTranslations} from "next-i18next/pages/serverSideTranslations";

const Admin = ({session}: { session: Session }) => {
    return (
        <SessionProvider session={session}>
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