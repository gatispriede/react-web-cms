export type AccountDashboardCardKey =
    | 'orders'
    | 'wishlist'
    | 'searches'
    | 'addresses'
    | 'payments'
    | 'settings';

export interface AccountDashboardCard {
    key: AccountDashboardCardKey;
    label: string;
    /** Destination route, e.g. '/account/orders'. */
    href: string;
    /** Optional count badge. Undefined => omit. */
    count?: number;
    /** Optional helper text below the count. */
    helper?: string;
    /** Optional iconography — caller-supplied ReactNode (icon font / SVG / emoji). */
    icon?: import('react').ReactNode;
}

export interface AccountDashboardGridProps {
    testId: string;
    /** Up to 6 cards in the default grid; caller controls order. */
    cards: AccountDashboardCard[];
    /** Optional aria-label for the grid container. */
    ariaLabel?: string;
}

/** Default-shape card spec — caller passes counts + hrefs. */
export const DEFAULT_CARD_DEFS: Record<AccountDashboardCardKey, {label: string; href: string}> = {
    orders: {label: 'Orders', href: '/account/orders'},
    wishlist: {label: 'Wishlist', href: '/account/wishlist'},
    searches: {label: 'Saved searches', href: '/account/searches'},
    addresses: {label: 'Addresses', href: '/account/addresses'},
    payments: {label: 'Payment methods', href: '/account/payments'},
    settings: {label: 'Settings', href: '/account/settings'},
};
