/**
 * `/account/orders` — system-page-backed thin loader
 * (all-pages-module-composed, Account batch).
 *
 * Renders entirely via `<SystemPageDispatch>` over the registered
 * `account-orders` system page. The order-history list + status
 * filter chips live in the locked `OrdersList` smart-wrapper module
 * (`ui/client/modules/_AccountPageModules/wrappers.tsx`), which binds
 * to the customer GraphQL surface. The route is a customer-session
 * guard + a single dispatch call.
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

interface OrdersPageProps {
    systemPage: ISystemPageSnapshot | null;
}

const OrdersHistoryPage: React.FC<OrdersPageProps> = ({systemPage}) => {
    const {t} = useTranslation('translation');
    const {t: tApp} = useTranslation('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>My orders</title></Head>
            <main data-testid="page-account-orders" style={{maxWidth: 880, margin: '0 auto', padding: '32px 20px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="account-orders" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<OrdersPageProps> = async (ctx) => {
    const guard = await requireCustomerSession(ctx);
    if (!guard.ok) return {redirect: guard.redirect};
    return {props: {systemPage: loadSystemPageSnapshot('account-orders')}};
};

export default OrdersHistoryPage;
