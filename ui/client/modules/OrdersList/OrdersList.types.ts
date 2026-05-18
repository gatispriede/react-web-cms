export type OrderListStatus = 'pending' | 'paid' | 'fulfilling' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'all';

export interface OrderListRow {
    id: string;
    orderNumber: string;
    /** ISO date. */
    placedAt: string;
    status: OrderListStatus;
    totalFormatted: string;
    /** Number of line items in the order. */
    itemCount: number;
    /** href to /account/orders/[id]. */
    href: string;
}

export interface OrdersListEmptyState {
    title: string;
    description?: string;
    primary?: {label: string; href?: string; onClick?: () => void};
}

export interface OrdersListProps {
    testId: string;
    orders: OrderListRow[];
    /** Optional status filter; 'all' (default) shows every order. */
    activeStatus?: OrderListStatus;
    onStatusChange?: (next: OrderListStatus) => void;
    /** Empty-state spec when orders.length === 0. */
    emptyState?: OrdersListEmptyState;
}

export enum EOrdersListStyle {
    Default = 'default',
    Cards = 'cards',
    Compact = 'compact',
    Table = 'table',
}
