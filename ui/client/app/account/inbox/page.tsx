/**
 * `/account/inbox` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/account/inbox.tsx`. The
 * locked `NotificationInbox` smart wrapper owns the list +
 * mark-read/dismiss interactions. Pages-Router file deleted in the
 * same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {requireCustomerSessionAppRouter} from '@client/lib/account/session';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import AccountInboxView from './AccountInboxView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Inbox'};

export default async function AccountInboxPage(): Promise<React.ReactElement> {
    await requireCustomerSessionAppRouter('/account/inbox');
    const systemPage = loadSystemPageSnapshot('account-inbox');
    return <AccountInboxView systemPage={systemPage}/>;
}
