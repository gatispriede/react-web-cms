/**
 * Release scheduler — polls every minute for draft releases with a
 * `scheduledFor` timestamp that has passed and auto-publishes them.
 *
 * Same in-process timer pattern as `BackupScheduler` (no external cron
 * daemon — the CMS is one long-running node process). Idempotent: a
 * second `registerReleaseScheduler` call cancels the first.
 *
 * Gating:
 *   - `RELEASES_SCHEDULER_ENABLED !== 'false'` — defaults ON because
 *     scheduled releases are a core editorial feature; flip it off only
 *     for split-brain deployments where a different process owns the
 *     scheduler.
 *
 * Failure mode: publish failures land the release in `failed` status
 * with `lastError` set by `ReleaseService.publish`. The scheduler logs
 * + moves on; operators see the banner in the admin pane. There is no
 * automatic retry — re-arming a failed release is an operator decision
 * (clear the schedule, fix the underlying problem, re-publish).
 */

import {log} from '@services/infra/logger';
import type {ReleaseService} from './ReleaseService';

let timers: NodeJS.Timeout[] = [];

export interface ReleaseSchedulerOptions {
    readonly env?: NodeJS.ProcessEnv;
    readonly checkIntervalMs?: number;
}

export function registerReleaseScheduler(
    svc: ReleaseService,
    opts: ReleaseSchedulerOptions = {},
): {registered: boolean; reason?: string} {
    cancelReleaseScheduler();
    const env = opts.env ?? process.env;
    if (env.RELEASES_SCHEDULER_ENABLED === 'false') {
        return {registered: false, reason: 'disabled'};
    }
    const checkMs = opts.checkIntervalMs ?? 60_000;
    const tick = async (): Promise<void> => {
        try {
            const due = await svc.listDue(new Date().toISOString());
            for (const r of due) {
                try {
                    await svc.publish({releaseId: r.id, actor: 'scheduler'});
                    log.info({scope: 'release.scheduler', releaseId: r.id}, 'scheduled release published');
                } catch (err) {
                    log.warn({scope: 'release.scheduler', releaseId: r.id, err}, 'scheduled publish failed');
                }
            }
        } catch (err) {
            log.warn({scope: 'release.scheduler', err}, 'scheduler tick failed');
        }
    };
    const id = setInterval(() => { void tick(); }, checkMs);
    if (typeof id.unref === 'function') id.unref();
    timers.push(id);
    log.info({scope: 'release.scheduler'}, 'release scheduler registered');
    return {registered: true};
}

export function cancelReleaseScheduler(): void {
    for (const id of timers) clearInterval(id);
    timers = [];
}
