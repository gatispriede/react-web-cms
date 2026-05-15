/**
 * `/account/inbox` — system-page-backed thin loader
 * (all-pages-module-composed, Account batch).
 *
 * Renders via `<SystemPageDispatch>` over the registered
 * `account-inbox` system page. The in-app notification list with
 * mark-read + dismiss lives in the locked `NotificationInbox`
 * smart-wrapper module (`ui/client/modules/_AccountPageModules/`),
 * which binds to the `myInbox` GraphQL query. Dismiss stays a
 * client-side hide — the underlying row keeps its 180-day TTL so the
 * delivery audit trail survives. The route is a customer-session
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

interface InboxPageProps {
    systemPage: ISystemPageSnapshot | null;
}

const InboxPage: React.FC<InboxPageProps> = ({systemPage}) => {
    const {t} = useTranslation('translation');
    const {t: tApp} = useTranslation('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Inbox</title></Head>
            <main data-testid="page-account-inbox" style={{maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="account-inbox" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<InboxPageProps> = async (ctx) => {
    const guard = await requireCustomerSession(ctx);
    if (!guard.ok) return {redirect: guard.redirect};
    return {props: {systemPage: loadSystemPageSnapshot('account-inbox')}};
};

export default InboxPage;
