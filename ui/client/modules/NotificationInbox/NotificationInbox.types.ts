export interface NotificationRow {
    id: string;
    /** Headline. */
    title: string;
    /** Body / secondary line. */
    body?: string;
    /** ISO timestamp. */
    createdAt: string;
    /** True when the notification has been viewed by the customer. */
    readAt?: string | null;
    /** Optional CTA link. */
    href?: string;
    /** Optional category for visual grouping ('order' | 'shipment' | 'wishlist' | 'system' | 'promo'). */
    category?: string;
}

export interface NotificationInboxEmptyState {
    title: string;
    description?: string;
    primary?: {label: string; href?: string; onClick?: () => void};
}

export interface NotificationInboxProps {
    testId: string;
    notifications: NotificationRow[];
    onMarkRead: (id: string) => void | Promise<void>;
    onMarkAllRead?: () => void | Promise<void>;
    onDelete?: (id: string) => void | Promise<void>;
    emptyState?: NotificationInboxEmptyState;
}
