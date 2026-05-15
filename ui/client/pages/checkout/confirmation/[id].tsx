/**
 * `/checkout/confirmation/[id]` — system-page-backed thin loader
 * (Phase 1.D-c). Renders via `<SystemPageDispatch>` over
 * `checkout-confirmation`. The `OrderSummary` + `MagicLinkAccountUpgrade`
 * + `ReferAFriendCta` / `SocialShareButtons` modules own the
 * confirmation-screen UX.
 */
import React from 'react';
import Head from 'next/head';
import {ConfigProvider} from 'antd';
import {useTranslation} from 'next-i18next/pages';
import type {GetServerSideProps} from 'next';
import staticTheme from '@client/features/Themes/themeConfig';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

const ConfirmationPage: React.FC<{systemPage: ISystemPageSnapshot | null}> = ({systemPage}) => {
    const {t} = useTranslation('common');
    const {t: tApp} = useTranslation('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Order confirmation</title></Head>
            <main data-testid="page-checkout-confirmation" style={{maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="checkout-confirmation" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<{systemPage: ISystemPageSnapshot | null}> = async () => {
    const systemPage = loadSystemPageSnapshot('checkout-confirmation');
    return {props: {systemPage}};
};

export default ConfirmationPage;
