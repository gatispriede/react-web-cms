import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {NotificationsService} from './NotificationsService';
import {registerQuietHoursWorker} from './QuietHoursQueue';
import {registerDigestCadenceWorker} from './DigestCadenceWorker';
import {registerWarmupQueueWorker} from '@services/features/Email/WarmupQueueWorker';
import {log} from '@services/infra/logger';

/**
 * W8f — Notifications feature loader.
 *
 * Owns per-user notification preferences (lives on the Users collection
 * via the `notificationPreferences` sub-doc), the in-app inbox
 * (`Notifications` collection), and the send-time policy helper used by
 * EmailService.
 *
 * Customer mutations (`setMyNotificationPreferences`,
 * `markInboxNotificationRead`) are session-injected — IDOR guard via
 * `_session.email` lookup, never client-supplied user id.
 *
 * Admin mutations are intentionally absent here — the only admin-grade
 * surface lives in the MCP tool layer (`notification.stats`,
 * `notification.preferences.get/set`) and the admin observability pane,
 * not in the customer SDL.
 */
export class NotificationsServiceLoader extends ServiceLoader {
    readonly id = 'notifications';
    readonly displayName = 'Customer notifications';

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {notifications: new NotificationsService(ctx.db)};
    }

    async onBoot(_ctx: FeatureContext): Promise<void> {
        // Register both deferred-send workers. Both are idempotent and
        // noop when their queue bucket is empty, so registering
        // unconditionally is safe even on operators who don't use
        // quiet-hours / digest. Disable with `NOTIFICATIONS_WORKERS=off`.
        if (process.env.NOTIFICATIONS_WORKERS === 'off') {
            log.info({scope: 'notifications.boot'}, 'notification workers disabled via env');
            return;
        }
        try {
            registerQuietHoursWorker();
            registerDigestCadenceWorker();
            // Warmup worker self-noops when warmup is disabled — safe to
            // always register from one boot site rather than threading a
            // separate EmailServiceLoader for it.
            registerWarmupQueueWorker();
        } catch (err) {
            log.warn({scope: 'notifications.boot', err}, 'failed to register notification workers');
        }
    }

    readonly schemaSDL = `extend type QueryMongo {
    """Customer's own notification preferences (with defaults merged)."""
    myNotificationPreferences: String!
    """Customer's inbox — most recent first."""
    myInbox(limit: Int, unreadOnly: Boolean): String!
    myInboxUnreadCount: Int!
    """Admin observability — per-category routing distribution + 24h inbox volume."""
    notificationStats: String!
}
extend type MutationMongo {
    """Patch the calling customer's notification preferences. Returns the merged blob."""
    setMyNotificationPreferences(prefs: JSON!): String!
    """Mark an inbox row as read."""
    markInboxNotificationRead(id: String!): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        customerMutations: [
            'setMyNotificationPreferences',
            'markInboxNotificationRead',
        ],
        customerQueries: [
            'myNotificationPreferences',
            'myInbox',
            'myInboxUnreadCount',
        ],
        customerSessionInjected: [
            'myNotificationPreferences',
            'myInbox',
            'myInboxUnreadCount',
            'setMyNotificationPreferences',
            'markInboxNotificationRead',
        ],
        queryRequirements: {
            notificationStats: 'admin',
        },
    };
}
