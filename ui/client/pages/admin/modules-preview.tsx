import React from 'react';
import LoginBtn from '@admin/features/Auth/login-btn';
import {SessionProvider} from 'next-auth/react';
import {Session} from 'next-auth';
import {GetServerSideProps} from 'next';
import {getServerSession} from 'next-auth/next';
import {authOptions} from '../api/auth/[...nextauth]';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';

/**
 * Admin modules-preview page (C10).
 *
 * Mirrors the shape of `/admin/settings` and `/admin/languages` — SSR-gated
 * via next-auth, then hands off to `LoginBtn` which dispatches the correct
 * inner view via `UserStatusBar`. The `view="modules-preview"` literal is
 * what `UserStatusBar` reads to render `<ModulesPreview>` in the main pane.
 */
const AdminModulesPreview = ({session}: {session: Session}) => (
    <SessionProvider session={session}>
        <LoginBtn view="modules-preview"/>
    </SessionProvider>
);

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

export default AdminModulesPreview;
