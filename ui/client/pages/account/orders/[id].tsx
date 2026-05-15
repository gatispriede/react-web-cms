/**
 * `/account/orders/[id]` — system-page-backed thin loader
 * (all-pages-module-composed, Account batch).
 *
 * Renders via `<SystemPageDispatch>` over the registered
 * `account-order-detail` system page. The order progress timeline,
 * line items, payment summary and status history live in the locked
 * `OrderDetail` smart-wrapper module — it reads the `[id]` route param
 * via `useRouter()` and binds to `myOrder()`. The route is a
 * customer-session guard + a single dispatch call.
 */
import React from 'react';
import Head from 'next/head';
import {ConfigProvider} from 'antd';
import {useTranslation} from 'next-i18next/pages';
import type {GetServerSideProps} from 'next';
import staticTheme from '@client/features/Themes/themeConfig';
import {requireCustomerSession} from '@client/lib/account/session';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface OrderDetailPageProps {
    systemPage: ISystemPageSnapshot | null;
}

const OrderDetailPage: React.FC<OrderDetailPageProps> = ({systemPage}) => {
    const {t} = useTranslation('translation');
    const {t: tApp} = useTranslation('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Order detail</title></Head>
            <main data-testid="page-account-order-detail" style={{maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="account-order-detail" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<OrderDetailPageProps> = async (ctx) => {
    const guard = await requireCustomerSession(ctx);
    if (!guard.ok) return {redirect: guard.redirect};
    return {props: {systemPage: loadSystemPageSnapshot('account-order-detail')}};
};

export default OrderDetailPage;
