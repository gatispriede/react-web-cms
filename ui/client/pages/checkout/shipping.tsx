/**
 * `/checkout/shipping` — system-page-backed thin loader (Phase 1.D-c).
 * Renders via `<SystemPageDispatch>` over `checkout-shipping`.
 */
import React from 'react';
import Head from 'next/head';
import {ConfigProvider} from 'antd';
import {useTranslation} from 'next-i18next/pages';
import type {GetServerSideProps} from 'next';
import staticTheme from '@client/features/Themes/themeConfig';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

const ShippingStep: React.FC<{systemPage: ISystemPageSnapshot | null}> = ({systemPage}) => {
    const {t} = useTranslation('translation');
    const {t: tApp} = useTranslation('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Shipping method</title></Head>
            <main data-testid="page-checkout-shipping" style={{maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="checkout-shipping" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<{systemPage: ISystemPageSnapshot | null}> = async () => {
    const systemPage = loadSystemPageSnapshot('checkout-shipping');
    return {props: {systemPage}};
};

export default ShippingStep;
