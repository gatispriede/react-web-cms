/**
 * Phase 1.B-d — Abandoned-cart recovery worker.
 *
 * Cron-fires every 5 min via `setInterval`. On each tick:
 *
 *   1. Read the site-flags (`commerce.abandonedCartEnabled`, delay,
 *      operator-supplied discount code). When the master switch is off,
 *      short-circuit — flipping the flag pauses the worker without a
 *      process restart.
 *   2. Query Mongo `Carts` for `status === 'active'` rows whose
 *      `updatedAt < (now - delayMinutes)` and whose `recoveryEmailSentAt`
 *      is unset. Customer-only — guest carts have no email-of-record.
 *   3. For each candidate:
 *      - Skip if the customer has opted out of `marketing` notifications
 *        (W8f) or is on the suppression list (W8c) — both gates live
 *        inside `sendWithPreference` so we just call it.
 *      - Mint a 30-day resume token (`cartTokens.ts`).
 *      - Render `abandoned-cart` template.
 *      - Send via `sendWithPreference` (`category: 'marketing'`).
 *      - Stamp `recoveryEmailSentAt` on the cart so the row is excluded
 *        from the next tick (one-shot recovery per spec).
 *
 * The worker is **idempotent** — a duplicate tick won't re-send because
 * the WHERE clause excludes rows with `recoveryEmailSentAt` set.
 *
 * Writes flow through `IAbandonedCartPort` so unit tests inject an in-
 * memory fake without touching Mongo / SMTP.
 */

import {log} from '@services/infra/logger';
import {mintResumeToken} from './cartTokens';
import {abandonedCartTemplate, type AbandonedCartLine} from '@services/features/Email/templates/abandoned-cart';
import type {IEmailTheme} from '@services/features/Email/templates/_shared/theme';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_DELAY_MIN = 60;

/**
 * One candidate cart resolved for sending. The port pre-joins the
 * customer's email + the per-line product titles + image URLs so the
 * worker stays small and free of N+1 fetch logic.
 */
export interface AbandonedCartCandidate {
    customerId: string;
    /** Used as the `id` in the resume token. */
    cartId: string;
    /** Resolved customer email — `null` skips the row. */
    to: string | null;
    /** Best-effort first-name fallback chain done by the port. */
    customerName: string;
    /** ISO-4217. */
    currency: string;
    /** Minor units. */
    subtotal: number;
    lines: AbandonedCartLine[];
}

/**
 * Lifecycle counters returned by `runTick()`. Used by the MCP
 * `cart.abandoned.stats` tool + admin pane recovery-rate stat.
 */
export interface AbandonedTickResult {
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    /** Candidates passed by the WHERE clause this tick. */
    candidates: number;
    /** Emails dispatched (sendWithPreference returned ok). */
    sent: number;
    /** Suppressed by W8c / W8f opt-out / suppression list. */
    suppressed: number;
    /** Hard errors during render/send (cart row left unchanged). */
    errors: number;
}

/**
 * Port the worker talks to. Implementations live in the
 * `CheckoutServiceLoader` (Mongo) and the worker's own `__tests__/`
 * (in-memory).
 */
export interface IAbandonedCartPort {
    /** Read the three flags in one round-trip — minor optimisation
     *  vs. three siteFlags reads. */
    readConfig(): Promise<{
        enabled: boolean;
        delayMinutes: number;
        discountCode: string;
        siteUrl: string;
        theme: IEmailTheme;
    }>;
    /** Find carts whose `updatedAt` is older than `staleBefore` AND
     *  status active AND `recoveryEmailSentAt` unset. */
    findStaleCustomerCarts(staleBefore: Date, limit: number): Promise<AbandonedCartCandidate[]>;
    /** Send a marketing-category email. Honors notification prefs +
     *  suppression list inside the implementation. Returns true when
     *  the message actually went out (not suppressed). */
    sendMarketingEmail(args: {
        to: string;
        subject: string;
        html: string;
        text: string;
    }): Promise<{ok: boolean; reason?: string}>;
    /** Stamp `recoveryEmailSentAt` so the row falls out of the next
     *  tick's WHERE clause. */
    markRecoveryEmailSent(cartId: string, at: Date): Promise<void>;
    /** Conversion hook — flips status to `recovered` and emits the
     *  audit event. Called from OrderService.finalize, not from the
     *  worker, but co-located on the port so the contract is one place. */
    markRecovered?(cartId: string, orderId: string): Promise<void>;
    /** Pull recent abandonments for the admin observability table.
     *  Read-only — no mutation. */
    listRecent(rangeHours: number, limit: number): Promise<Array<{
        cartId: string;
        customerId: string;
        updatedAt: string;
        recoveryEmailSentAt?: string | null;
        status: 'active' | 'recovered' | 'converted' | 'abandoned';
        subtotal: number;
        currency: string;
    }>>;
    /** Counts for the recovery-rate stat. */
    countStats(rangeHours: number): Promise<{
        recoveryEmailsSent: number;
        recovered: number;
        active: number;
        abandoned: number;
    }>;
}

export interface AbandonedCartWorkerOptions {
    intervalMs?: number;
    /** Test seam — clock injection. */
    now?: () => Date;
    /** Per-tick cap — guards against catastrophic backlogs on day-1
     *  rollout. Default 100. */
    candidateLimit?: number;
}

/**
 * The worker. Mirrors the `WarehousePageSyncWorker` shape — `start()`
 * schedules + immediately fires one boot tick; `stop()` cleans up;
 * `runNow()` exposes a manual trigger for MCP + tests.
 */
export class AbandonedCartWorker {
    private timer: ReturnType<typeof setInterval> | null = null;
    private readonly intervalMs: number;
    private readonly now: () => Date;
    private readonly candidateLimit: number;
    private inFlight = false;
    private lastResult: AbandonedTickResult | null = null;

    constructor(
        private readonly port: IAbandonedCartPort,
        opts: AbandonedCartWorkerOptions = {},
    ) {
        this.intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
        this.now = opts.now ?? (() => new Date());
        this.candidateLimit = Math.max(1, opts.candidateLimit ?? 100);
    }

    /** Kick off the cron loop. Idempotent. */
    start(): void {
        if (this.timer) return;
        this.timer = setInterval(() => {
            void this.tick().catch(err => log.error({scope: 'abandonedCart.tick', err}, 'tick crashed'));
        }, this.intervalMs);
        // Boot tick — operator-friendly so the dashboard isn't empty for 5 min after restart.
        void this.tick().catch(err => log.error({scope: 'abandonedCart.bootTick', err}, 'boot tick crashed'));
    }

    /** Clear the interval. Test teardown + admin "pause" pathway. */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /** Force a tick now. Returns the counters so admin / MCP can render. */
    async runNow(): Promise<AbandonedTickResult> {
        return this.runTick();
    }

    /** Last completed tick — `null` until the first tick lands. */
    getLastResult(): AbandonedTickResult | null {
        return this.lastResult;
    }

    private async tick(): Promise<void> {
        if (this.inFlight) return;
        this.inFlight = true;
        try {
            await this.runTick();
        } finally {
            this.inFlight = false;
        }
    }

    /**
     * One tick of work. Public-by-default so tests can drive it
     * directly without dealing with the setInterval re-entrancy lock.
     */
    private async runTick(): Promise<AbandonedTickResult> {
        const startedAt = this.now().toISOString();
        const start = Date.now();
        const counts = {candidates: 0, sent: 0, suppressed: 0, errors: 0};
        try {
            const cfg = await this.port.readConfig();
            if (!cfg.enabled) {
                // Flag off — bail. We still record the tick so the
                // admin pane can say "ran at ... (paused)".
                return this.finish(startedAt, start, counts);
            }
            const delayMin = Math.max(1, Math.floor(cfg.delayMinutes || DEFAULT_DELAY_MIN));
            const staleBefore = new Date(this.now().getTime() - delayMin * 60_000);
            const candidates = await this.port.findStaleCustomerCarts(staleBefore, this.candidateLimit);
            counts.candidates = candidates.length;

            for (const c of candidates) {
                if (!c.to) {
                    // No email-of-record (rare — customer row without
                    // verified email). Skip silently.
                    counts.suppressed += 1;
                    continue;
                }
                try {
                    // 30-day resume token — long enough to outlive a
                    // weekend without re-prompting the customer.
                    const token = mintResumeToken(c.customerId, 'customer', () => Date.now());
                    const resumeUrl = `${cfg.siteUrl.replace(/\/$/, '')}/cart?resume=${token}`;
                    const rendered = abandonedCartTemplate.html({
                        customerName: c.customerName,
                        lines: c.lines,
                        currency: c.currency,
                        subtotal: c.subtotal,
                        resumeUrl,
                        discountCode: cfg.discountCode || undefined,
                    }, cfg.theme);
                    const text = abandonedCartTemplate.text({
                        customerName: c.customerName,
                        lines: c.lines,
                        currency: c.currency,
                        subtotal: c.subtotal,
                        resumeUrl,
                        discountCode: cfg.discountCode || undefined,
                    });
                    const subject = abandonedCartTemplate.subject({
                        customerName: c.customerName,
                        lines: c.lines,
                        currency: c.currency,
                        subtotal: c.subtotal,
                        resumeUrl,
                    });
                    const res = await this.port.sendMarketingEmail({
                        to: c.to,
                        subject,
                        html: rendered,
                        text,
                    });
                    if (res.ok) {
                        counts.sent += 1;
                        await this.port.markRecoveryEmailSent(c.cartId, this.now());
                    } else {
                        counts.suppressed += 1;
                    }
                } catch (err) {
                    counts.errors += 1;
                    log.error(
                        {scope: 'abandonedCart.send', cartId: c.cartId, err},
                        'abandoned-cart recovery send failed (swallowed)',
                    );
                }
            }
        } catch (err) {
            counts.errors += 1;
            log.error({scope: 'abandonedCart.runTick', err}, 'abandoned-cart tick failed');
        }
        return this.finish(startedAt, start, counts);
    }

    private finish(
        startedAt: string,
        startMs: number,
        counts: {candidates: number; sent: number; suppressed: number; errors: number},
    ): AbandonedTickResult {
        const result: AbandonedTickResult = {
            startedAt,
            finishedAt: this.now().toISOString(),
            durationMs: Date.now() - startMs,
            ...counts,
        };
        this.lastResult = result;
        return result;
    }
}
