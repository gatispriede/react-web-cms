import React from 'react';
import Head from 'next/head';
import type {GetServerSideProps} from 'next';
import {requireCustomerSession} from '@client/lib/account/session';
import {AccountSettingsLayout} from '@client/components/AccountSettings/AccountSettingsLayout';
import {ALL_TABS, type AccountSettingsTab} from '@client/components/AccountSettings/types';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {getCustomerProfileService} from '@services/features/Customer/CustomerProfileService';
import {SiteFlagsService} from '@services/features/Seo/SiteFlagsService';
import type {IUser} from '@interfaces/IUser';

/**
 * `/account/settings` — system-page-backed customer settings surface.
 *
 *   1. Customer-session guard via `requireCustomerSession()`.
 *   2. SSR-load the calling customer's profile (server-side; the
 *      session is the only id authority — never trust a query param).
 *   3. Server-resolve the operator-hidden tab list +
 *      `commerce.accountSettingsEnabled` master switch.
 *   4. Render the layout with `?tab=` dispatched to the active form.
 *
 * SEO: noindex,nofollow (transactional surface; sitemap-excluded by
 * the system-page registry's `seo.indexable: false`).
 */
interface SettingsPageProps {
    me: IUser;
    activeTab: AccountSettingsTab;
    hiddenTabs: AccountSettingsTab[];
    enabled: boolean;
}

const SettingsPage: React.FC<SettingsPageProps> = ({me, activeTab, hiddenTabs, enabled}) => {
    if (!enabled) {
        return (
            <>
                <Head>
                    <meta name="robots" content="noindex,nofollow"/>
                    <title>Settings unavailable</title>
                </Head>
                <main data-testid="account-settings-disabled">
                    <h1>Settings are not available on this site.</h1>
                </main>
            </>
        );
    }
    return (
        <>
            <Head>
                <meta name="robots" content="noindex,nofollow"/>
                <title>Account settings</title>
            </Head>
            <main>
                <AccountSettingsLayout me={me} activeTab={activeTab} hiddenTabs={hiddenTabs}/>
            </main>
        </>
    );
};

function parseTab(value: unknown): AccountSettingsTab {
    if (typeof value === 'string' && (ALL_TABS as readonly string[]).includes(value)) {
        return value as AccountSettingsTab;
    }
    return 'profile';
}

export const getServerSideProps: GetServerSideProps<SettingsPageProps> = async (ctx) => {
    const guard = await requireCustomerSession(ctx);
    if (!guard.ok) return {redirect: guard.redirect};

    const email = (guard.session?.user as {email?: string} | undefined)?.email ?? '';
    const conn = getMongoConnection() as unknown as {database?: never};
    if (!conn.database) {
        return {props: {me: {id: '', name: '', email, password: '', kind: 'customer'} as IUser, activeTab: 'profile', hiddenTabs: [], enabled: false}};
    }
    const svc = getCustomerProfileService(conn.database as never);
    // `requireCustomerSession` already attests `kind: customer` —
    // resolve the row by email since that's the session-pinned key.
    const usersCol = (conn.database as unknown as {collection: (n: string) => {findOne: (q: never, opts?: never) => Promise<unknown>}}).collection('Users');
    const found = await usersCol.findOne({email: email.toLowerCase(), kind: 'customer'} as never, {projection: {_id: 0}} as never);
    const me = (found as IUser | null) ?? null;
    if (!me) {
        return {redirect: {destination: '/account/signin', permanent: false}};
    }
    void svc; // service initialised eagerly so first MCP call doesn't pay a cold-singleton cost

    const flags = new SiteFlagsService(conn.database as never);
    const flagsBlob = await flags.get();
    const sub = (flagsBlob?.commerce ?? {}) as Record<string, unknown>;
    const hiddenRaw = Array.isArray(sub.accountSettingsHiddenTabs) ? sub.accountSettingsHiddenTabs as string[] : [];
    const hiddenTabs = hiddenRaw.filter(t => (ALL_TABS as readonly string[]).includes(t)) as AccountSettingsTab[];
    const enabled = sub.accountSettingsEnabled !== false;

    return {
        props: {
            me: JSON.parse(JSON.stringify(me)) as IUser,
            activeTab: parseTab(ctx.query.tab),
            hiddenTabs,
            enabled,
        },
    };
};

export default SettingsPage;
