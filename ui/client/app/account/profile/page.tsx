/**
 * `/account/profile` — module-compose pass 2026-05-17.
 *
 * Loads the `account-profile` system page snapshot (mounts the locked
 * `AccountProfileForm` smart wrapper) and hands it to the client view.
 * Replaces the previous bespoke profile + password JSX with a single
 * SystemPageDispatch call so operators can compose marketing modules
 * around the locked block.
 */
import React from 'react';
import type {Metadata} from 'next';
import {requireCustomerSessionAppRouter} from '@client/lib/account/session';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import AccountProfileView from './AccountProfileView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Profile'};

export default async function AccountProfilePage(): Promise<React.ReactElement> {
    await requireCustomerSessionAppRouter('/account/profile');
    const systemPage = loadSystemPageSnapshot('account-profile');
    return <AccountProfileView systemPage={systemPage}/>;
}
