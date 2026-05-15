/**
 * `/account/signup` — system-page-backed thin loader
 * (all-pages-module-composed, Auth batch).
 *
 * Renders via `<SystemPageDispatch>` over the registered
 * `account-signup` system page. The sign-up surface — including the
 * optional B2B (company name + VAT id) capture and the magic-link /
 * password / OAuth method toggles — lives in the locked `SignupForm`
 * smart-wrapper module (`ui/client/modules/_AccountPageModules/`).
 */
import React from 'react';
import Head from 'next/head';
import {ConfigProvider} from 'antd';
import {useTranslation} from 'next-i18next/pages';
import type {GetServerSideProps} from 'next';
import staticTheme from '@client/features/Themes/themeConfig';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface SignupPageProps {
    systemPage: ISystemPageSnapshot | null;
}

const SignupPage: React.FC<SignupPageProps> = ({systemPage}) => {
    const {t} = useTranslation('translation');
    const {t: tApp} = useTranslation('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Create your account</title><meta name="robots" content="noindex,nofollow"/></Head>
            <main data-testid="page-account-signup" style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', background: '#f5f5f5'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="account-signup" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<SignupPageProps> = async () => {
    return {props: {systemPage: loadSystemPageSnapshot('account-signup')}};
};

export default SignupPage;
