/**
 * W8f — NotificationsService.
 *
 * Owns:
 *  - Per-user `notificationPreferences` reads/writes (lives on the
 *    `Users` collection alongside profile fields — single-row-per-human
 *    invariant; we don't create a parallel collection).
 *  - In-app inbox writes (Mongo `Notifications` collection) + read /
 *    mark-read / list.
 *  - Send-time policy resolution (`shouldSend`) for `EmailService` and
 *    future channels — pure function over the persisted prefs.
 *
 * Quiet hours + digest cadence are persisted today; the queue / worker
 * that actually defers + batches is a follow-up (TODO below). The
 * `shouldSend` helper still returns the right deferral hint so callers
 * can stash a "queued" record in EmailLog and a digest worker can pick
 * it up later.
 */

import {Collection, Db} from 'mongodb';
import guid from '@utils/guid';
import {log} from '@services/infra/logger';
import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    INotificationPreferences,
    NotificationCategory,
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_ROUTINGS,
    DIGEST_CADENCES,
    isInQuietHours,
    isMandatoryCategory,
    resolveRouting,
} from '@interfaces/INotificationPreferences';
import type {INotification} from '@interfaces/INotification';

export interface SendDecision {
    /** Whether the email channel should fire now. */
    email: boolean;
    /** Whether the inbox row should be written. */
    inbox: boolean;
    /**
     * 'send'    — fire all opted-in channels now.
     * 'queue'   — defer past quiet hours (worker TODO).
     * 'digest'  — buffer for the cadence digest (worker TODO).
     * 'suppressed' — fully opted out (transactional ignores this).
     */
    decision: 'send' | 'queue' | 'digest' | 'suppressed';
    /** Free-form reason for audit / EmailLog. */
    reason?: string;
}

export class NotificationsService {
    private usersDB: Collection;
    private inboxDB: Collection;
    private inboxIndexesReady = false;

    constructor(db: Db) {
        this.usersDB = db.collection('Users');
        this.inboxDB = db.collection('Notifications');
    }

    private async ensureInboxIndexes(): Promise<void> {
        if (this.inboxIndexesReady) return;
        try {
            await this.inboxDB.createIndex({userId: 1, createdAt: -1});
            await this.inboxDB.createIndex({userId: 1, readAt: 1});
            await this.inboxDB.createIndex({id: 1}, {unique: true});
            // 180-day inbox retention. Older rows auto-evict.
            const INBOX_TTL_DAYS = 180;
            await this.inboxDB.createIndex(
                {createdAt: 1},
                {expireAfterSeconds: INBOX_TTL_DAYS * 24 * 60 * 60},
            );
            this.inboxIndexesReady = true;
        } catch (err) {
            log.error({scope: 'notifications.ensureIndexes', err}, 'inbox ensureIndexes failed');
        }
    }

    // ── Preferences ────────────────────────────────────────────────────

    async getPreferences(userId: string): Promise<INotificationPreferences> {
        if (!userId) return DEFAULT_NOTIFICATION_PREFERENCES;
        try {
            const u = await this.usersDB.findOne({id: userId}, {projection: {notificationPreferences: 1}}) as any;
            return mergeDefaults(u?.notificationPreferences);
        } catch (err) {
            log.error({scope: 'notifications.getPrefs', err, userId}, 'getPreferences failed');
            return DEFAULT_NOTIFICATION_PREFERENCES;
        }
    }

    async getPreferencesByEmail(email: string): Promise<{userId: string | null; prefs: INotificationPreferences}> {
        if (!email) return {userId: null, prefs: DEFAULT_NOTIFICATION_PREFERENCES};
        try {
            const u = await this.usersDB.findOne(
                {email: email.trim().toLowerCase()},
                {projection: {id: 1, notificationPreferences: 1}},
            ) as any;
            if (!u) return {userId: null, prefs: DEFAULT_NOTIFICATION_PREFERENCES};
            return {userId: u.id, prefs: mergeDefaults(u.notificationPreferences)};
        } catch (err) {
            log.error({scope: 'notifications.getPrefsByEmail', err}, 'getPreferencesByEmail failed');
            return {userId: null, prefs: DEFAULT_NOTIFICATION_PREFERENCES};
        }
    }

    /**
     * Patch one user's preferences. Validates enums + clamps mandatory
     * categories to 'both'. Always stamps `updatedAt`.
     */
    async setPreferences(
        userId: string,
        patch: Partial<INotificationPreferences>,
    ): Promise<INotificationPreferences> {
        if (!userId) throw new Error('userId is required');
        const current = await this.getPreferences(userId);
        const next: INotificationPreferences = {
            byCategory: {...current.byCategory},
            quietHours: patch.quietHours ?? current.quietHours,
            digestCadence: patch.digestCadence ?? current.digestCadence ?? 'immediate',
            updatedAt: new Date().toISOString(),
        };
        if (patch.byCategory) {
            for (const [k, v] of Object.entries(patch.byCategory)) {
                if (!NOTIFICATION_CATEGORIES.includes(k as NotificationCategory)) continue;
                if (!NOTIFICATION_ROUTINGS.includes(v as any)) continue;
                if (isMandatoryCategory(k as NotificationCategory) && v === 'off') {
                    next.byCategory[k as NotificationCategory] = 'both';
                } else {
                    next.byCategory[k as NotificationCategory] = v as any;
                }
            }
        }
        if (patch.digestCadence && !DIGEST_CADENCES.includes(patch.digestCadence)) {
            throw new Error(`invalid digestCadence: ${patch.digestCadence}`);
        }
        if (next.quietHours) {
            const {start, end, timezone} = next.quietHours;
            if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || !timezone) {
                throw new Error('quietHours requires start/end as HH:mm and a valid IANA timezone');
            }
        }
        await this.usersDB.updateOne({id: userId}, {$set: {notificationPreferences: next}});
        return next;
    }

    /**
     * Granular unsubscribe — sets one category to 'off'. Used by the
     * RFC 8058 one-click endpoint. Returns the updated prefs.
     */
    async optOut(userId: string, category: NotificationCategory): Promise<INotificationPreferences> {
        if (isMandatoryCategory(category)) {
            // Transactional cannot be opted out of; idempotently no-op.
            return this.getPreferences(userId);
        }
        return this.setPreferences(userId, {byCategory: {[category]: 'off'}});
    }

    /** Marketing kill-switch — sets every non-mandatory category to 'off'. */
    async optOutAllMarketing(userId: string): Promise<INotificationPreferences> {
        const patch: Partial<INotificationPreferences> = {byCategory: {}};
        for (const c of NOTIFICATION_CATEGORIES) {
            if (!isMandatoryCategory(c)) patch.byCategory![c] = 'off';
        }
        return this.setPreferences(userId, patch);
    }

    // ── Send-time decision ─────────────────────────────────────────────

    /**
     * Pure(ish) policy check. Pass `now` for tests. Does NOT mutate state
     * — the caller decides what to do with the decision (send, drop,
     * stash in EmailLog as 'suppressed', queue for digest worker).
     */
    shouldSend(prefs: INotificationPreferences | undefined | null, category: NotificationCategory, now: Date = new Date()): SendDecision {
        const effective = mergeDefaults(prefs);
        const routing = resolveRouting(effective, category);
        if (routing === 'off') {
            return {email: false, inbox: false, decision: 'suppressed', reason: 'category-opt-out'};
        }
        const wantsEmail = routing === 'email' || routing === 'both';
        const wantsInbox = routing === 'inbox' || routing === 'both';
        // Transactional bypasses quiet hours + digest — receipts must
        // deliver on the spot.
        if (isMandatoryCategory(category)) {
            return {email: wantsEmail, inbox: wantsInbox, decision: 'send'};
        }
        if (wantsEmail && isInQuietHours(effective.quietHours, now)) {
            return {email: wantsEmail, inbox: wantsInbox, decision: 'queue', reason: 'quiet-hours'};
        }
        const cadence = effective.digestCadence ?? 'immediate';
        if (wantsEmail && cadence !== 'immediate') {
            return {email: wantsEmail, inbox: wantsInbox, decision: 'digest', reason: `cadence:${cadence}`};
        }
        return {email: wantsEmail, inbox: wantsInbox, decision: 'send'};
    }

    // ── Inbox ──────────────────────────────────────────────────────────

    async writeInbox(input: Omit<INotification, 'id' | 'createdAt'> & {id?: string; createdAt?: string}): Promise<string> {
        await this.ensureInboxIndexes();
        const row: INotification = {
            id: input.id ?? guid(),
            userId: input.userId,
            category: input.category,
            title: input.title,
            body: input.body,
            actionUrl: input.actionUrl,
            actionLabel: input.actionLabel,
            metadata: input.metadata,
            deliveredChannels: input.deliveredChannels ?? ['inbox'],
            createdAt: input.createdAt ?? new Date().toISOString(),
        };
        await this.inboxDB.insertOne(row as any);
        return row.id;
    }

    async listInbox({userId, limit = 50, unreadOnly = false}: {userId: string; limit?: number; unreadOnly?: boolean}): Promise<INotification[]> {
        await this.ensureInboxIndexes();
        const filter: any = {userId};
        if (unreadOnly) filter.readAt = {$exists: false};
        const docs = await this.inboxDB.find(filter).sort({createdAt: -1}).limit(Math.min(limit, 200)).toArray();
        return docs.map(d => ({
            id: (d as any).id,
            userId: (d as any).userId,
            category: (d as any).category,
            title: (d as any).title,
            body: (d as any).body,
            actionUrl: (d as any).actionUrl,
            actionLabel: (d as any).actionLabel,
            metadata: (d as any).metadata,
            deliveredChannels: (d as any).deliveredChannels,
            readAt: (d as any).readAt,
            archivedAt: (d as any).archivedAt,
            createdAt: (d as any).createdAt,
        }));
    }

    async markRead({userId, id}: {userId: string; id: string}): Promise<boolean> {
        await this.ensureInboxIndexes();
        const r = await this.inboxDB.updateOne(
            {id, userId, readAt: {$exists: false}},
            {$set: {readAt: new Date().toISOString()}},
        );
        return r.modifiedCount > 0;
    }

    async unreadCount(userId: string): Promise<number> {
        await this.ensureInboxIndexes();
        return this.inboxDB.countDocuments({userId, readAt: {$exists: false}, archivedAt: {$exists: false}});
    }

    // ── Stats (admin observability) ────────────────────────────────────

    /**
     * Aggregate per-category opt-in counts across customers. Cheap on
     * small populations; for larger ones swap to a Mongo aggregation
     * pipeline. Today the project is small enough that a full scan
     * answers in tens of ms.
     */
    async aggregateStats(): Promise<{
        customers: number;
        perCategory: Array<{category: NotificationCategory; both: number; email: number; inbox: number; off: number}>;
        recentInboxCount: number;
    }> {
        const customers = await this.usersDB.find(
            {kind: 'customer'},
            {projection: {notificationPreferences: 1}},
        ).toArray();
        const totals: Record<NotificationCategory, {both: number; email: number; inbox: number; off: number}> = {} as any;
        for (const c of NOTIFICATION_CATEGORIES) totals[c] = {both: 0, email: 0, inbox: 0, off: 0};
        for (const u of customers) {
            const prefs = mergeDefaults((u as any).notificationPreferences);
            for (const c of NOTIFICATION_CATEGORIES) {
                const routing = resolveRouting(prefs, c);
                totals[c][routing]++;
            }
        }
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let recentInboxCount = 0;
        try {
            recentInboxCount = await this.inboxDB.countDocuments({createdAt: {$gte: since.toISOString()}});
        } catch { /* fresh deployments have no collection yet — non-fatal */ }
        return {
            customers: customers.length,
            perCategory: NOTIFICATION_CATEGORIES.map(c => ({category: c, ...totals[c]})),
            recentInboxCount,
        };
    }
}

function mergeDefaults(p: INotificationPreferences | undefined | null): INotificationPreferences {
    if (!p) return DEFAULT_NOTIFICATION_PREFERENCES;
    return {
        byCategory: {...DEFAULT_NOTIFICATION_PREFERENCES.byCategory, ...(p.byCategory ?? {})},
        quietHours: p.quietHours,
        digestCadence: p.digestCadence ?? DEFAULT_NOTIFICATION_PREFERENCES.digestCadence,
        updatedAt: p.updatedAt,
    };
}
