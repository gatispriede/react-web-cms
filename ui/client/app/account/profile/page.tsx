/**
 * `/account/profile` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/account/profile.tsx`.
 * Customer-session guard then renders the `'use client'` profile +
 * password-change forms. All form I/O stays client-side via `gql()`.
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {requireCustomerSessionAppRouter} from '@client/lib/account/session';
import AccountProfileView from './AccountProfileView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Profile'};

export default async function AccountProfilePage(): Promise<React.ReactElement> {
    await requireCustomerSessionAppRouter('/account/profile');
    return <AccountProfileView/>;
}
