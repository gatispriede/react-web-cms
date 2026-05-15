/**
 * Polish bundle (W8f follow-up) — quiet-hours flush worker.
 *
 * Fires every 5 minutes. Reads rows from `NotificationDeferrals` whose
 * `reason === 'quiet-hours'`, re-resolves the recipient's prefs (their
 * quiet-hours window may have shifted or been disabled) and, when the
 * window is now over, fires the original `sendEmail` payload and
 * deletes the row.
 *
 * Idempotency: rows are removed after a successful send. A row that
 * fails to send stays in the queue and is retried on the next tick —
 * bounded by the 7-day TTL on the collection (rows older than that
 * get TTL-evicted by Mongo). That's the right trade-off for this
 * volume: a transient SMTP outage doesn't lose mail, and a permanent
 * one doesn't fill the disk.
 *
 * Gating: only registers when at least one user has quiet hours
 * configured? — too expensive to check on every tick. We register
 * unconditionally and noop when the queue is empty.
 */

import {log} from '@services/infra/logger';
import {sendEmail} from '@services/features/Email/EmailService';
import {NotificationsService} from './NotificationsService';
import {getNotificationDeferralQueue, NotificationDeferralQueue} from './NotificationDeferralQueue';
import {isInQuietHours} from '@interfaces/INotificationPreferences';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import type {ISiteFlags} from '@services/features/Seo/SiteFlagsService';

const TICK_MS = 5 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;

export interface QuietHoursSchedulerOptions {
    readonly tickMs?: number;
    readonly siteFlagsGetter?: () => Promise<ISiteFlags | undefined>;
}

/** Idempotent — calling twice tears down the prior interval. */
export function registerQuietHoursWorker(opts: QuietHoursSchedulerOptions = {}): {registered: boolean; reason?: string} {
    cancelQuietHoursWorker();
    const tickMs = opts.tickMs ?? TICK_MS;
    const tick = (): void => {
        void flushQuietHoursOnce(opts.siteFlagsGetter).catch((err: unknown) => {
            log.warn({scope: 'quietHours.worker.tick', err}, 'quiet-hours flush tick failed');
        });
    };
    const id = setInterval(tick, tickMs);
    if (typeof id.unref === 'function') id.unref();
    timer = id;
    log.info({scope: 'quietHours.worker', tickMs}, 'quiet-hours queue worker registered');
    return {registered: true};
}

export function cancelQuietHoursWorker(): void {
    if (timer) clearInterval(timer);
    timer = null;
}

/** Single tick — exported for tests + admin "run now" tools. */
export async function flushQuietHoursOnce(
    siteFlagsGetter?: () => Promise<ISiteFlags | undefined>,
): Promise<{flushed: number; skipped: number; failed: number}> {
    const conn = getMongoConnection();
    const db = conn.database;
    if (!db) return {flushed: 0, skipped: 0, failed: 0};
    const queue: NotificationDeferralQueue | null = getNotificationDeferralQueue(db);
    if (!queue) return {flushed: 0, skipped: 0, failed: 0};

    const rows = await queue.list('quiet-hours');
    if (!rows.length) return {flushed: 0, skipped: 0, failed: 0};

    const notifications = new NotificationsService(db);
    const mail = siteFlagsGetter ? (await siteFlagsGetter())?.mail : undefined;
    const now = new Date();

    let flushed = 0;
    let skipped = 0;
    let failed = 0;
    for (const row of rows) {
        try {
            // Re-resolve prefs — user may have changed quiet-hours
            // settings since the row was queued.
            const prefs = row.userId
                ? await notifications.getPreferences(row.userId)
                : (await notifications.getPreferencesByEmail(row.to)).prefs;
            if (isInQuietHours(prefs.quietHours, now)) {
                skipped++;
                continue;
            }
            const result = await sendEmail(mail, row.payload);
            if (result.ok) {
                await queue.remove(row.id);
                flushed++;
            } else if (result.skippedReason === 'suppressed') {
                // Permanent — drop the row, EmailService already logged it.
                await queue.remove(row.id);
                flushed++;
            } else {
                failed++;
            }
        } catch (err) {
            log.warn({scope: 'quietHours.worker.row', err, id: row.id}, 'row flush failed');
            failed++;
        }
    }
    log.info({scope: 'quietHours.worker', flushed, skipped, failed, total: rows.length}, 'quiet-hours tick complete');
    return {flushed, skipped, failed};
}
