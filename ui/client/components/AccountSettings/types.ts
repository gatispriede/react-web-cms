/**
 * client-account-settings-page (Phase 1.E) — shared types for the
 * AccountSettings storefront components. The shapes mirror the
 * `accountSettings.*` / `customer.*` MCP-tool responses so a single
 * envelope flows through `ViewModel → form → render` without
 * remapping.
 */
import type {IUser} from '@interfaces/IUser';

export type AccountSettingsTab =
    | 'profile'
    | 'security'
    | 'addresses'
    | 'payment'
    | 'notifications'
    | 'privacy'
    | 'language';

export const ALL_TABS: AccountSettingsTab[] = [
    'profile',
    'security',
    'addresses',
    'payment',
    'notifications',
    'privacy',
    'language',
];

export interface AccountSettingsProps {
    me: IUser;
    activeTab: AccountSettingsTab;
    /** Operator-hidden tab list (from `commerce.accountSettingsHiddenTabs`). */
    hiddenTabs?: AccountSettingsTab[];
    /** SSR-bound onMutate hook to allow page-level optimistic refresh. */
    onMutated?: () => void;
}
