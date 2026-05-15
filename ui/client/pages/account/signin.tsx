/**
 * `/account/signin` — system-page-backed thin loader
 * (all-pages-module-composed, Auth batch).
 *
 * Renders via `<SystemPageDispatch>` over the registered
 * `account-signin` system page. The magic-link-first sign-in surface
 * (password / OAuth behind the module's own disclosure) lives in the
 * locked `SigninForm` smart-wrapper module
 * (`ui/client/modules/_AccountPageModules/authWrappers.tsx`), which
 * reads provider config from `/api/site/auth-flags`.
 *
 * The hard 404 on `siteFlags.auth.clientLoginEnabled === false` stays
 * server-side here — belt-and-braces behind the edge middleware.
 */
import React from 'react';
import Head from 'next/head';
import {ConfigProvider} from 'antd';
import {useTranslation} from 'next-i18next/pages';
import type {GetServerSideProps} from 'next';
import staticTheme from '@client/features/Themes/themeConfig';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface SigninPageProps {
    systemPage: ISystemPageSnapshot | null;
}

const SigninPage: React.FC<SigninPageProps> = ({systemPage}) => {
    const {t} = useTranslation('translation');
    const {t: tApp} = useTranslation('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Sign in</title><meta name="robots" content="noindex,nofollow"/></Head>
            <main data-testid="page-account-signin" style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', background: '#f5f5f5'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="account-signin" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<SigninPageProps> = async () => {
    let clientLoginEnabled = true;
    try {
        const auth = (await getMongoConnection().siteFlagsService.get()).auth ?? {};
        clientLoginEnabled = (auth as {clientLoginEnabled?: boolean}).clientLoginEnabled !== false;
    } catch { /* flag service unavailable — keep the route reachable */ }
    if (!clientLoginEnabled) return {notFound: true};
    return {props: {systemPage: loadSystemPageSnapshot('account-signin')}};
};

export default SigninPage;
