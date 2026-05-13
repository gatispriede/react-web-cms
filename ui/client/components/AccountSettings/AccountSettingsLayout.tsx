import React, {useState} from 'react';
import Link from 'next/link';
import {AccountSettingsNav} from './AccountSettingsNav';
import {ProfileSettingsForm} from './ProfileSettingsForm';
import {SecuritySettingsForm} from './SecuritySettingsForm';
import {AddressesForm} from './AddressesForm';
import {PaymentMethodsForm} from './PaymentMethodsForm';
import {LanguageSettingsForm} from './LanguageSettingsForm';
import {NotificationPreferencesForm} from '@client/components/Account/NotificationPreferencesForm';
import {DataRightsForm} from '@client/components/Account/DataRightsForm';
import type {AccountSettingsProps, AccountSettingsTab} from './types';
import type {IUser} from '@interfaces/IUser';

/**
 * Page shell for `/account/settings`. Owns:
 *   - "Settings for {name}" hero
 *   - <AccountSettingsNav>
 *   - the active tab's form (dispatches on `?tab=`)
 *
 * Phase 1.E follow-up: Notifications + Privacy tabs now mount the
 * extracted W8f + W8b forms inline (no deep-link to a separate page).
 * The legacy `/account/notifications` and `/account/privacy` URLs
 * redirect here for back-compat.
 */

const TAB_LABELS: Record<AccountSettingsTab, string> = {
    profile: 'Profile',
    security: 'Security',
    addresses: 'Addresses',
    payment: 'Payment',
    notifications: 'Notifications',
    privacy: 'Privacy',
    language: 'Language',
};

function dispatchTab(tab: AccountSettingsTab, me: IUser, onMutated: () => void): React.ReactNode {
    switch (tab) {
        case 'profile':       return <ProfileSettingsForm me={me} onMutated={onMutated}/>;
        case 'security':      return <SecuritySettingsForm/>;
        case 'addresses':     return <AddressesForm me={me} onMutated={onMutated}/>;
        case 'payment':       return <PaymentMethodsForm me={me} onMutated={onMutated}/>;
        case 'notifications': return <NotificationPreferencesForm onSave={onMutated}/>;
        case 'privacy':       return <DataRightsForm onSave={onMutated}/>;
        case 'language':      return <LanguageSettingsForm me={me} onMutated={onMutated}/>;
    }
}

export const AccountSettingsLayout: React.FC<AccountSettingsProps> = (props) => {
    const [bump, setBump] = useState(0);
    const onMutated = () => {
        setBump(b => b + 1);
        props.onMutated?.();
    };
    return (
        <div className="account-settings-layout" data-testid="account-settings-layout" data-bump={bump}>
            <header className="account-settings-hero" data-testid="account-settings-hero">
                <h1>Settings for {props.me.name || props.me.email}</h1>
                <nav className="breadcrumb">
                    <Link href="/account">Account</Link> / <span>Settings</span>
                </nav>
            </header>
            <AccountSettingsNav
                active={props.activeTab}
                hiddenTabs={props.hiddenTabs}
                labelFor={t => TAB_LABELS[t]}
            />
            <section className="account-settings-content" data-testid={`account-settings-tab-${props.activeTab}`}>
                {dispatchTab(props.activeTab, props.me, onMutated)}
            </section>
        </div>
    );
};

export default AccountSettingsLayout;
