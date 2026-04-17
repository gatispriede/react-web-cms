import React from 'react'
import LoginBtn from "../../components/Auth/login-btn";
import {SessionProvider} from "next-auth/react";
import {Session} from "next-auth";
import {GetServerSideProps} from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "../api/auth/[...nextauth]";
import {serverSideTranslations} from 'next-i18next/serverSideTranslations';

const AdminSettings = ({session}: {session: Session}) => {
    return (
        <SessionProvider session={session}>
            <LoginBtn settings={true}/>
        </SessionProvider>
    );
};

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

export default AdminSettings;
