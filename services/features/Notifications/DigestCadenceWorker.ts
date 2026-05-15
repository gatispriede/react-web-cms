/**
 * Polish bundle (W8f follow-up) — digest cadence worker.
 *
 * Bundles `digestCadence: 'hourly' | 'daily' | 'weekly'` notifications.
 * Fires hourly and, on each tick, flushes any user whose configured
 * cadence has elapsed since their last digest. Emits a single
 * concatenated digest email per user per period via `sendEmail`.
 *
 * State: tick boundary is computed from `NotificationDeferralRow.queuedAt`
 * — when the oldest row for a user is older than the cadence window
 * (1h / 24h / 7d) we flush all of that user's rows in a single mail.
 * Keeps the implementation stateless — no per-user "lastDigestAt"
 * cursor needed.
 *
 * Output: subject = "Your <cadence> digest (<N> updates)" and body =
 * itemised list of `subject + first 200 chars of preview`. Plain-text
 * digest is enough for v1; an HTML template can land later without
 * changing the worker shape.
 */

import {log} from '@services/infra/logger';
import {sendEmail} from '@services/features/Email/EmailService';
import {getNotificationDeferralQueue, NotificationDeferralQueue, NotificationDeferralRow} from './NotificationDeferralQueue';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import type {ISiteFlags} from '@services/features/Seo/SiteFlagsService';
import type {DigestCadence} from '@interfaces/INotificationPreferences';

const TICK_MS = 60 * 60 * 1000;

const CADENCE_WINDOW_MS: Record<DigestCadence, number> = {
    immediate: 0,
    hourly: 60 * 60 * 1000,
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
};

let timer: NodeJS.Timeout | null = null;

export interface DigestSchedulerOptions {
    readonly tickMs?: number;
    readonly siteFlagsGetter?: () => Promise<ISiteFlags | undefined>;
}

export function registerDigestCadenceWorker(opts: DigestSchedulerOptions = {}): {registered: boolean} {
    cancelDigestCadenceWorker();
    const tickMs = opts.tickMs ?? TICK_MS;
    const tick = (): void => {
        void flushDigestsOnce(opts.siteFlagsGetter).catch((err: unknown) => {
            log.warn({scope: 'digest.worker.tick', err}, 'digest flush tick failed');
        });
    };
    const id = setInterval(tick, tickMs);
    if (typeof id.unref === 'function') id.unref();
    timer = id;
    log.info({scope: 'digest.worker', tickMs}, 'digest cadence worker registered');
    return {registered: true};
}

export function cancelDigestCadenceWorker(): void {
    if (timer) clearInterval(timer);
    timer = null;
}

/** Single tick — exported for tests + admin "run now" tools. */
export async function flushDigestsOnce(
    siteFlagsGetter?: () => Promise<ISiteFlags | undefined>,
): Promise<{users: number; emails: number; failed: number}> {
    const conn = getMongoConnection();
    const db = conn.database;
    if (!db) return {users: 0, emails: 0, failed: 0};
    const queue: NotificationDeferralQueue | null = getNotificationDeferralQueue(db);
    if (!queue) return {users: 0, emails: 0, failed: 0};

    const mail = siteFlagsGetter ? (await siteFlagsGetter())?.mail : undefined;
    const now = Date.now();

    // Pull each cadence bucket; group by `to` so guests (no userId) still digest.
    const cadences: DigestCadence[] = ['hourly', 'daily', 'weekly'];
    let totalEmails = 0;
    let totalFailed = 0;
    const seenUsers = new Set<string>();

    for (const cadence of cadences) {
        const rows = await queue.list(cadence);
        if (!rows.length) continue;
        const byKey = new Map<string, NotificationDeferralRow[]>();
        for (const r of rows) {
            const key = r.userId ?? `email:${r.to}`;
            const bucket = byKey.get(key) ?? [];
            bucket.push(r);
            byKey.set(key, bucket);
        }
        for (const [key, bucket] of byKey) {
            const oldest = bucket[0]?.queuedAt?.getTime?.() ?? bucket[0]?.queuedAt as unknown as number;
            const oldestMs = typeof oldest === 'number' ? oldest : new Date(oldest as unknown as string).getTime();
            if (now - oldestMs < CADENCE_WINDOW_MS[cadence]) continue; // window not elapsed
            seenUsers.add(key);
            const ok = await flushOneDigest(bucket, cadence, mail, queue);
            if (ok) totalEmails++;
            else totalFailed++;
        }
    }
    log.info({scope: 'digest.worker', users: seenUsers.size, emails: totalEmails, failed: totalFailed}, 'digest tick complete');
    return {users: seenUsers.size, emails: totalEmails, failed: totalFailed};
}

async function flushOneDigest(
    bucket: NotificationDeferralRow[],
    cadence: DigestCadence,
    mail: ISiteFlags['mail'] | undefined,
    queue: NotificationDeferralQueue,
): Promise<boolean> {
    const to = bucket[0].to;
    const subject = `Your ${cadence} digest (${bucket.length} update${bucket.length === 1 ? '' : 's'})`;
    const text = bucket
        .map(r => `• ${r.payload.subject}\n  ${stripPreview(r.payload.text ?? r.payload.html ?? '')}`)
        .join('\n\n');
    const html = bucket
        .map(r => `<li><strong>${escapeHtml(r.payload.subject)}</strong><br><span style="color:#666">${escapeHtml(stripPreview(r.payload.text ?? r.payload.html ?? ''))}</span></li>`)
        .join('');
    try {
        const result = await sendEmail(mail, {
            to,
            subject,
            text,
            html: `<ul style="padding-left:20px;line-height:1.6;font-family:Arial,sans-serif">${html}</ul>`,
        });
        if (result.ok || result.skippedReason === 'suppressed') {
            // Remove rows regardless of suppression — the recipient
            // can't receive mail; piling them up is wasted disk.
            for (const r of bucket) {
                try { await queue.remove(r.id); } catch { /* non-fatal */ }
            }
            return result.ok;
        }
        return false;
    } catch (err) {
        log.warn({scope: 'digest.worker.flushOne', err, to}, 'digest flush failed');
        return false;
    }
}

function stripPreview(s: string): string {
    return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
}
