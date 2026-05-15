/**
 * In-app inbox row. One per delivered notification, per recipient.
 * Stored in the `Notifications` Mongo collection (created lazily by
 * `NotificationsService` on first write).
 */

import type {NotificationCategory} from './INotificationPreferences';

export interface INotification {
    id: string;
    /** User id (customer or admin) that owns the inbox row. */
    userId: string;
    category: NotificationCategory;
    title: string;
    body: string;
    /** Optional deep-link the inbox row renders as a primary action. */
    actionUrl?: string;
    actionLabel?: string;
    /** Free-form template metadata (orderId, productId, etc). */
    metadata?: Record<string, unknown>;
    /** Channels the send-time helper actually delivered to. */
    deliveredChannels?: Array<'email' | 'inbox'>;
    /** ISO; set when the user opens the inbox row. */
    readAt?: string;
    /** ISO; set when the user archives or system auto-archives. */
    archivedAt?: string;
    createdAt: string;
}
