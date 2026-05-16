/**
 * `/account/settings` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/account/settings.tsx`.
 *
 *   1. Customer-session guard via `requireCustomerSessionAppRouter()`.
 *   2. SSR-load the calling customer's profile (server-side; the
 *      session is the only id authority — never trust a query param).
 *   3. Server-resolve the operator-hidden tab list +
 *      `commerce.accountSettingsEnabled` master switch.
 *   4. Render the `'use client'` layout with `?tab=` dispatched to the
 *      active form.
 *
 * SEO: noindex,nofollow (transactional surface; sitemap-excluded by
 * the system-page registry's `seo.indexable: false`).
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {requireCustomerSessionAppRouter} from '@client/lib/account/session';
import {ALL_TABS, type AccountSettingsTab} from '@client/components/AccountSettings/types';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {getCustomerProfileService} from '@services/features/Customer/CustomerProfileService';
import {SiteFlagsService} from '@services/features/Seo/SiteFlagsService';
import type {IUser} from '@interfaces/IUser';
import AccountSettingsView from './AccountSettingsView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Account settings',
    robots: {index: false, follow: false},
};

function parseTab(value: unknown): AccountSettingsTab {
    if (typeof value === 'string' && (ALL_TABS as readonly string[]).includes(value)) {
        return value as AccountSettingsTab;
    }
    return 'profile';
}

export default async function AccountSettingsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
    const session = await requireCustomerSessionAppRouter('/account/settings');
    const sp = await searchParams;
    const tabRaw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
    const activeTab = parseTab(tabRaw);

    const email = ((session as {user?: {email?: string}} | null)?.user?.email) ?? '';
    const conn = getMongoConnection() as unknown as {database?: never};
    if (!conn.database) {
        const me: IUser = {id: '', name: '', email, password: '', kind: 'customer'} as IUser;
        return <AccountSettingsView me={me} activeTab={activeTab} hiddenTabs={[]} enabled={false}/>;
    }

    const svc = getCustomerProfileService(conn.database as never);
    void svc; // initialised eagerly so first MCP call doesn't pay cold-singleton cost

    // `requireCustomerSessionAppRouter` already attests `kind: customer` —
    // resolve the row by email since that's the session-pinned key.
    const usersCol = (conn.database as unknown as {collection: (n: string) => {findOne: (q: never, opts?: never) => Promise<unknown>}}).collection('Users');
    const found = await usersCol.findOne({email: email.toLowerCase(), kind: 'customer'} as never, {projection: {_id: 0}} as never);
    const me = (found as IUser | null) ?? null;
    if (!me) redirect('/account/signin');

    const flags = new SiteFlagsService(conn.database as never);
    const flagsBlob = await flags.get();
    const sub = (flagsBlob?.commerce ?? {}) as Record<string, unknown>;
    const hiddenRaw = Array.isArray(sub.accountSettingsHiddenTabs) ? sub.accountSettingsHiddenTabs as string[] : [];
    const hiddenTabs = hiddenRaw.filter(t => (ALL_TABS as readonly string[]).includes(t)) as AccountSettingsTab[];
    const enabled = sub.accountSettingsEnabled !== false;

    return (
        <AccountSettingsView
            me={JSON.parse(JSON.stringify(me)) as IUser}
            activeTab={activeTab}
            hiddenTabs={hiddenTabs}
            enabled={enabled}
        />
    );
}
