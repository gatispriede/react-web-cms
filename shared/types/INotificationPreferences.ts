/**
 * W8f — Customer notification preferences.
 *
 * Categories are an enum, not free text (see project standard
 * `feedback_predefined_selections.md`). The set has been culled to the
 * categories the platform actually sends today + the obvious near-term
 * surfaces; SMS / push channels are deferred per the roadmap spec
 * (`docs/roadmap/storefront/customer-notification-preferences.md`).
 *
 * Per-category routing — one of:
 *   - 'both'  : email + in-app inbox
 *   - 'email' : email only
 *   - 'inbox' : in-app inbox only
 *   - 'off'   : suppressed (transactional category ignores 'off')
 *
 * Quiet hours + digest cadence are persisted alongside the routing map.
 * The send-time helper checks routing first, then quiet hours, then
 * digest cadence — only 'immediate' bypasses the digest queue.
 */

export type NotificationCategory =
    | 'transactional'      // receipts, account-security — mandatory, can't be turned off
    | 'order-update'       // shipping, delivery, refund
    | 'marketing'          // newsletters, campaigns — default OFF
    | 'inquiry-reply'      // operator replies to a customer inquiry
    | 'low-stock'          // back-in-stock / wishlist price-drop
    | 'comment-reply';     // someone replied to a blog comment

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
    'transactional',
    'order-update',
    'marketing',
    'inquiry-reply',
    'low-stock',
    'comment-reply',
];

/** Per-category channel routing. `transactional` ignores 'off'. */
export type NotificationRouting = 'both' | 'email' | 'inbox' | 'off';

export const NOTIFICATION_ROUTINGS: NotificationRouting[] = ['both', 'email', 'inbox', 'off'];

export type DigestCadence = 'immediate' | 'hourly' | 'daily' | 'weekly';

export const DIGEST_CADENCES: DigestCadence[] = ['immediate', 'hourly', 'daily', 'weekly'];

export interface IQuietHours {
    /** 'HH:mm' — start (inclusive). */
    start: string;
    /** 'HH:mm' — end (exclusive). May be earlier than `start` for overnight windows. */
    end: string;
    /** IANA timezone, e.g. 'Europe/Riga'. */
    timezone: string;
}

export interface INotificationPreferences {
    /** Per-category routing. Missing categories fall back to defaults below. */
    byCategory: Partial<Record<NotificationCategory, NotificationRouting>>;
    /** Optional quiet-hours window — non-critical sends defer past it. */
    quietHours?: IQuietHours;
    /**
     * Digest cadence — applies to non-critical categories. 'immediate'
     * (default) sends right away; other values buffer until the next
     * digest tick.
     */
    digestCadence?: DigestCadence;
    /** ISO timestamp — last edit. Used by audit + admin observability. */
    updatedAt?: string;
}

/**
 * Default routing for a freshly-onboarded customer. `marketing` is OFF
 * by default per EU / commercial-best-practice. Transactional is locked
 * to 'both' — the UI surfaces it disabled.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: INotificationPreferences = {
    byCategory: {
        transactional: 'both',
        'order-update': 'both',
        marketing: 'off',
        'inquiry-reply': 'both',
        'low-stock': 'inbox',
        'comment-reply': 'inbox',
    },
    digestCadence: 'immediate',
};

/** Categories that cannot be opted out of. The UI greys them out. */
export const MANDATORY_CATEGORIES: NotificationCategory[] = ['transactional'];

export function isMandatoryCategory(c: NotificationCategory): boolean {
    return MANDATORY_CATEGORIES.includes(c);
}

/**
 * Resolve effective routing for a category given a (possibly partial)
 * preferences blob. Falls back to `DEFAULT_NOTIFICATION_PREFERENCES`
 * for unset categories. Mandatory categories ignore 'off'.
 */
export function resolveRouting(
    prefs: INotificationPreferences | undefined | null,
    category: NotificationCategory,
): NotificationRouting {
    const explicit = prefs?.byCategory?.[category];
    const fallback = DEFAULT_NOTIFICATION_PREFERENCES.byCategory[category] ?? 'both';
    const v = explicit ?? fallback;
    if (isMandatoryCategory(category) && v === 'off') return 'both';
    return v;
}

/**
 * Naïve quiet-hours check — accepts overnight windows (start > end).
 * Pure function so unit tests don't need a clock fake.
 */
export function isInQuietHours(qh: IQuietHours | undefined, now: Date): boolean {
    if (!qh || !qh.start || !qh.end || !qh.timezone) return false;
    // Resolve "now" in the customer's timezone via Intl. Cheap + dep-free.
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: qh.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    let hhmm: string;
    try {
        hhmm = fmt.format(now); // 'HH:MM' (24h)
    } catch {
        return false;
    }
    const minutes = (s: string): number => {
        const [h, m] = s.split(':').map(n => Number(n));
        if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
        return h * 60 + m;
    };
    const nowM = minutes(hhmm.replace(/[^0-9:]/g, ''));
    const startM = minutes(qh.start);
    const endM = minutes(qh.end);
    if (Number.isNaN(nowM) || Number.isNaN(startM) || Number.isNaN(endM)) return false;
    if (startM === endM) return false;
    if (startM < endM) return nowM >= startM && nowM < endM;
    // Overnight window — e.g. 22:00 → 08:00.
    return nowM >= startM || nowM < endM;
}
