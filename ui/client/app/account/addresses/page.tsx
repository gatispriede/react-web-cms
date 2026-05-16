/**
 * `/account/addresses` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/account/addresses.tsx`.
 * Customer-session guard via `requireCustomerSessionAppRouter()` (which
 * `throw`s `redirect(...)` for non-customers), then loads the
 * `account-addresses` system-page snapshot and hands it to the
 * `'use client'` view. The locked `AddressList` smart wrapper owns the
 * list + add/edit modal. Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {requireCustomerSessionAppRouter} from '@client/lib/account/session';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import AccountAddressesView from './AccountAddressesView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Shipping addresses'};

export default async function AccountAddressesPage(): Promise<React.ReactElement> {
    await requireCustomerSessionAppRouter('/account/addresses');
    const systemPage = loadSystemPageSnapshot('account-addresses');
    return <AccountAddressesView systemPage={systemPage}/>;
}
