/**
 * `/account` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/account/index.tsx`.
 * Customer-session guard then renders the `'use client'` home view.
 * The per-customer profile + saved-addresses fetch stays client-side
 * (uses the customer GraphQL surface via `gql()`). Pages-Router file
 * deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {requireCustomerSessionAppRouter} from '@client/lib/account/session';
import AccountHomeView from './AccountHomeView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'My account'};

export default async function AccountHomePage(): Promise<React.ReactElement> {
    await requireCustomerSessionAppRouter('/account');
    return <AccountHomeView/>;
}
