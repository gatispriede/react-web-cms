/**
 * `/account/addresses` — system-page-backed thin loader
 * (all-pages-module-composed, Account batch).
 *
 * Renders via `<SystemPageDispatch>` over the registered
 * `account-addresses` system page. The address-book list + add/edit
 * modal live in the locked `AddressList` smart-wrapper module
 * (`ui/client/modules/_AccountPageModules/wrappers.tsx`). The route is
 * a customer-session guard + a single dispatch call.
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

interface AddressesPageProps {
    systemPage: ISystemPageSnapshot | null;
}

const AddressesPage: React.FC<AddressesPageProps> = ({systemPage}) => {
    const {t} = useTranslation('translation');
    const {t: tApp} = useTranslation('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Shipping addresses</title></Head>
            <main data-testid="page-account-addresses" style={{maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="account-addresses" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<AddressesPageProps> = async (ctx) => {
    const guard = await requireCustomerSession(ctx);
    if (!guard.ok) return {redirect: guard.redirect};
    return {props: {systemPage: loadSystemPageSnapshot('account-addresses')}};
};

export default AddressesPage;
