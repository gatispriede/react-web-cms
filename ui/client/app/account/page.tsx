/**
 * `/account` — App Router migration, Batch 5 + module-compose pass
 * 2026-05-17.
 *
 * Server-Component port of the former `pages/account/index.tsx`.
 * Customer-session guard, then loads the `account-home` system-page
 * snapshot (registered in `services/features/Customer/CustomerAccountPages.ts`)
 * and hands it to the `'use client'` view. The locked
 * `AccountDashboardGridHost` smart wrapper owns the per-customer
 * grid (saved-address count fetched client-side via the existing
 * customer GraphQL surface).
 *
 * Previously this page rendered a hand-coded `AccountHomeView` with
 * bespoke profile + addresses cards and a `signOut()` button. With
 * the dashboard now module-composed, operators can compose marketing
 * modules around the locked section without touching JSX.
 */
import React from 'react';
import type {Metadata} from 'next';
import {requireCustomerSessionAppRouter} from '@client/lib/account/session';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import AccountHomeView from './AccountHomeView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'My account'};

export default async function AccountHomePage(): Promise<React.ReactElement> {
    await requireCustomerSessionAppRouter('/account');
    const systemPage = loadSystemPageSnapshot('account-home');
    return <AccountHomeView systemPage={systemPage}/>;
}
