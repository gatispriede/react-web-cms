/**
 * `/account/orders` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/account/orders/index.tsx`.
 * Locked `OrdersList` smart wrapper owns the history list + status
 * filter chips. Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {requireCustomerSessionAppRouter} from '@client/lib/account/session';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import AccountOrdersView from './AccountOrdersView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'My orders'};

export default async function AccountOrdersPage(): Promise<React.ReactElement> {
    await requireCustomerSessionAppRouter('/account/orders');
    const systemPage = loadSystemPageSnapshot('account-orders');
    return <AccountOrdersView systemPage={systemPage}/>;
}
