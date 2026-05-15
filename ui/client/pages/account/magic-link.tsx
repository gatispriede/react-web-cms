/**
 * `/account/magic-link` — system-page-backed thin loader
 * (all-pages-module-composed, Auth batch).
 *
 * Renders via `<SystemPageDispatch>` over the registered
 * `account-magic-link` system page. The passwordless sign-in request
 * form lives in the locked `MagicLinkRequestForm` smart-wrapper module
 * (`ui/client/modules/_AccountPageModules/authWrappers.tsx`), which
 * POSTs `/api/auth/magic-request`. The response is intentionally
 * opaque — same "check your inbox" copy regardless of whether the
 * email exists.
 */
import React from 'react';
import Head from 'next/head';
import {ConfigProvider} from 'antd';
import {useTranslation} from 'next-i18next/pages';
import type {GetServerSideProps} from 'next';
import staticTheme from '@client/features/Themes/themeConfig';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface MagicLinkPageProps {
    systemPage: ISystemPageSnapshot | null;
}

const MagicLinkPage: React.FC<MagicLinkPageProps> = ({systemPage}) => {
    const {t} = useTranslation('translation');
    const {t: tApp} = useTranslation('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Sign in with a magic link</title><meta name="robots" content="noindex,nofollow"/></Head>
            <main data-testid="page-account-magic-link" style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', background: '#f5f5f5'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="account-magic-link" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<MagicLinkPageProps> = async () => {
    return {props: {systemPage: loadSystemPageSnapshot('account-magic-link')}};
};

export default MagicLinkPage;
