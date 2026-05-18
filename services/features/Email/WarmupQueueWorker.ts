/**
 * Polish bundle (W8c follow-up) — warmup over-cap queue worker.
 *
 * When `EMAIL_WARMUP_ENABLED=true`, `EmailService` short-circuits sends
 * past the daily ramp cap with `skippedReason: 'warmup-skipped'`.
 * Without this worker, those sends are dropped — admins see a
 * `warmup-skipped` row in `EmailLog` but the recipient never gets the
 * mail. This worker holds an in-memory deferral list: callers that
 * receive a `warmup-skipped` result hand the payload to
 * `enqueueWarmupDeferred(payload)` and the worker retries on its tick.
 *
 * Why in-memory not Mongo: warmup is a transient (≤30-day) phase. The
 * deliverability cost of losing a deferred send on a process restart
 * is lower than the operational cost of a parallel persistent queue
 * (the Mongo-backed `NotificationDeferrals` collection serves the
 * preference layer; warmup is a transport-level concern that already
 * has process locality via the rate limiter). Operators who need
 * durable retries should disable warmup and use a managed sender.
 *
 * Tick: every 15 minutes. On tick: peek warmup status, if `remaining > 0`
 * drain that many rows from the queue and fire them.
 */

import {log} from '@services/infra/logger';
import {sendEmail, EmailPayload} from './EmailService';
import {getWarmupLimiter} from './emailServices';
import type {ISiteFlags} from '@services/features/Seo/SiteFlagsService';
import {warmupEnabled, warmupStartMs} from './WarmupRateLimiter';

const TICK_MS = 15 * 60 * 1000;
const MAX_QUEUE = 10_000;

interface QueuedSend {
    payload: EmailPayload;
    queuedAt: number;
}

const queue: QueuedSend[] = [];
let timer: NodeJS.Timeout | null = null;

export interface WarmupSchedulerOptions {
    readonly tickMs?: number;
    readonly siteFlagsGetter?: () => Promise<ISiteFlags | undefined>;
}

/** Public: enqueue a payload the caller couldn't send because of warmup cap. */
export function enqueueWarmupDeferred(payload: EmailPayload): {queued: boolean; reason?: string} {
    if (!warmupEnabled() || warmupStartMs() === null) {
        return {queued: false, reason: 'warmup-disabled'};
    }
    if (queue.length >= MAX_QUEUE) {
        log.warn({scope: 'warmup.queue', size: queue.length}, 'warmup queue full; dropping');
        return {queued: false, reason: 'queue-full'};
    }
    queue.push({payload, queuedAt: Date.now()});
    return {queued: true};
}

export function warmupQueueSize(): number {
    return queue.length;
}

export function _resetWarmupQueueForTests(): void {
    queue.length = 0;
}

export function registerWarmupQueueWorker(opts: WarmupSchedulerOptions = {}): {registered: boolean; reason?: string} {
    cancelWarmupQueueWorker();
    if (!warmupEnabled()) return {registered: false, reason: 'warmup-disabled'};
    const tickMs = opts.tickMs ?? TICK_MS;
    const tick = (): void => {
        void flushWarmupOnce(opts.siteFlagsGetter).catch((err: unknown) => {
            log.warn({scope: 'warmup.worker.tick', err}, 'warmup flush tick failed');
        });
    };
    const id = setInterval(tick, tickMs);
    if (typeof id.unref === 'function') id.unref();
    timer = id;
    log.info({scope: 'warmup.worker', tickMs}, 'warmup queue worker registered');
    return {registered: true};
}

export function cancelWarmupQueueWorker(): void {
    if (timer) clearInterval(timer);
    timer = null;
}

/** Single tick — exported for tests + admin "run now" tools. */
export async function flushWarmupOnce(
    siteFlagsGetter?: () => Promise<ISiteFlags | undefined>,
): Promise<{flushed: number; failed: number; remaining: number; capRemaining: number}> {
    if (!queue.length) return {flushed: 0, failed: 0, remaining: 0, capRemaining: 0};
    const limiter = getWarmupLimiter();
    if (!limiter) return {flushed: 0, failed: 0, remaining: queue.length, capRemaining: 0};
    const status = await limiter.status();
    if (!status.enabled) return {flushed: 0, failed: 0, remaining: queue.length, capRemaining: Number.POSITIVE_INFINITY};

    const mail = siteFlagsGetter ? (await siteFlagsGetter())?.mail : undefined;
    const capRemaining = Math.max(0, status.capToday - status.sentToday);
    // Cap drain per tick to leave headroom for live (non-deferred) sends.
    const drain = Math.min(queue.length, Math.floor(capRemaining * 0.8));
    let flushed = 0;
    let failed = 0;
    for (let i = 0; i < drain; i++) {
        const next = queue.shift();
        if (!next) break;
        try {
            const result = await sendEmail(mail, next.payload);
            if (result.ok) {
                flushed++;
            } else if (result.skippedReason === 'warmup-skipped') {
                // Hit the cap mid-drain — push back to front and stop.
                queue.unshift(next);
                break;
            } else {
                // Permanent fail (suppressed / config error) — drop.
                failed++;
            }
        } catch (err) {
            log.warn({scope: 'warmup.worker.row', err}, 'warmup flush row failed');
            queue.unshift(next);
            failed++;
            break;
        }
    }
    log.info({scope: 'warmup.worker', flushed, failed, remaining: queue.length}, 'warmup tick complete');
    return {flushed, failed, remaining: queue.length, capRemaining};
}
