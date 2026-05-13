import React from 'react';
import Link from 'next/link';
import {ALL_TABS, AccountSettingsTab} from './types';

/**
 * Tab bar for `/account/settings`. Renders one `<Link>` per visible
 * tab (hidden tabs come from `commerce.accountSettingsHiddenTabs`).
 * The active tab is matched via `?tab=` on the parent page.
 *
 * Storefront-styled (the admin-shell `<Tabs>` deliberately isn't
 * used here — auth-split-client-admin keeps the two surfaces
 * separate). Per-theme styling lives in `auth.scss`.
 */
export interface AccountSettingsNavProps {
    active: AccountSettingsTab;
    hiddenTabs?: AccountSettingsTab[];
    labelFor: (tab: AccountSettingsTab) => string;
}

export const AccountSettingsNav: React.FC<AccountSettingsNavProps> = ({active, hiddenTabs = [], labelFor}) => {
    const visible = ALL_TABS.filter(t => !hiddenTabs.includes(t));
    return (
        <nav className="account-settings-nav" data-testid="account-settings-nav">
            <ul>
                {visible.map(tab => (
                    <li key={tab} className={tab === active ? 'is-active' : ''}>
                        <Link
                            href={`/account/settings?tab=${tab}`}
                            data-testid={`account-settings-nav-tab-${tab}`}
                        >
                            {labelFor(tab)}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default AccountSettingsNav;
