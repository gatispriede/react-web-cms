/**
 * `/account/orders/[id]` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/account/orders/[id].tsx`.
 * The locked `OrderDetail` smart wrapper reads the `[id]` route param
 * via `useParams()` (now in `next/navigation`, see the
 * `_AccountPageModules/wrappers.tsx` swap that lands alongside this
 * route). Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {requireCustomerSessionAppRouter} from '@client/lib/account/session';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import AccountOrderDetailView from './AccountOrderDetailView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Order detail'};

interface RouteParams {
    id: string;
}

export default async function AccountOrderDetailPage({
    params,
}: {
    params: Promise<RouteParams>;
}): Promise<React.ReactElement> {
    const {id} = await params;
    await requireCustomerSessionAppRouter(`/account/orders/${id}`);
    const systemPage = loadSystemPageSnapshot('account-order-detail');
    return <AccountOrderDetailView systemPage={systemPage}/>;
}
