'use client';
/**
 * Client view for `/account/settings` — App Router migration, Batch 5.
 * Direct lift of the visible body from the former
 * `pages/account/settings.tsx`. The `<Head>` `robots` tag moves to the
 * server file's `metadata` block; the `<title>` is also handled there.
 */
import React from 'react';
import {AccountSettingsLayout} from '@client/components/AccountSettings/AccountSettingsLayout';
import type {AccountSettingsTab} from '@client/components/AccountSettings/types';
import type {IUser} from '@interfaces/IUser';

interface AccountSettingsViewProps {
    me: IUser;
    activeTab: AccountSettingsTab;
    hiddenTabs: AccountSettingsTab[];
    enabled: boolean;
}

const AccountSettingsView: React.FC<AccountSettingsViewProps> = ({me, activeTab, hiddenTabs, enabled}) => {
    if (!enabled) {
        return (
            <main data-testid="account-settings-disabled">
                <h1>Settings are not available on this site.</h1>
            </main>
        );
    }
    return (
        <main>
            <AccountSettingsLayout me={me} activeTab={activeTab} hiddenTabs={hiddenTabs}/>
        </main>
    );
};

export default AccountSettingsView;
