import {log} from '@services/infra/logger';
import type {BackupService} from './BackupService';

/**
 * W8e — Backup cron registration.
 *
 * The CMS doesn't run a process-level cron daemon; backups need to fire
 * inside the long-running node process. `setInterval` keyed off the cron
 * expression is good enough for the two slots we need:
 *   - daily full (default 03:00)
 *   - hourly oplog tail (every 6h)
 *
 * Cron expression support is minimal — we parse the first two fields
 * (`minute hour`) and ignore the rest. That's sufficient for both
 * defaults (daily at 03:00 and hourly-by-six). Operators who need a
 * more elaborate schedule should run restic via systemd timers instead,
 * per the runbook.
 *
 * Gating: only registers when `BACKUP_ENABLED=true` AND the BackupService
 * `enabled()` gate passes (creds set). Idempotent — calling
 * `registerBackupCron` twice tears down the first set of timers.
 */

let registered: NodeJS.Timeout[] = [];

export interface SchedulerOptions {
    readonly env?: NodeJS.ProcessEnv;
    readonly checkIntervalMs?: number;
}

export function registerBackupCron(svc: BackupService, opts: SchedulerOptions = {}): {registered: boolean; reason?: string} {
    cancelBackupCron();
    const env = opts.env ?? process.env;
    if (env.BACKUP_ENABLED !== 'true') return {registered: false, reason: 'disabled'};
    const checkMs = opts.checkIntervalMs ?? 60_000;
    const daily = parseCron(env.BACKUP_SCHEDULE_DAILY || '0 3 * * *');
    const hourly = parseCron(env.BACKUP_SCHEDULE_HOURLY || '0 */6 * * *');
    if (!daily || !hourly) {
        log.warn({scope: 'backup.cron'}, 'invalid cron expressions — backup cron not registered');
        return {registered: false, reason: 'invalid-cron'};
    }
    let lastDailyTick = '';
    let lastHourlyTick = '';
    const tick = (): void => {
        const now = new Date();
        const key = `${now.toISOString().slice(0, 13)}`;
        const m = now.getUTCMinutes();
        const h = now.getUTCHours();
        if (matches(daily, m, h) && lastDailyTick !== key) {
            lastDailyTick = key;
            void svc.backupNow({label: 'scheduled-daily', actor: 'cron'}).catch((err: unknown) => {
                log.error({scope: 'backup.cron.daily', err}, 'daily backup failed');
            });
            void svc.pruneSnapshots({actor: 'cron'}).catch(() => {});
        }
        if (matches(hourly, m, h) && lastHourlyTick !== key) {
            lastHourlyTick = key;
            void svc.backupNow({label: 'scheduled-hourly', actor: 'cron'}).catch((err: unknown) => {
                log.error({scope: 'backup.cron.hourly', err}, 'hourly backup failed');
            });
        }
    };
    const id = setInterval(tick, checkMs);
    if (typeof id.unref === 'function') id.unref();
    registered.push(id);
    log.info({scope: 'backup.cron'}, 'backup cron registered');
    return {registered: true};
}

export function cancelBackupCron(): void {
    for (const id of registered) clearInterval(id);
    registered = [];
}

interface ParsedCron {
    readonly minutes: ReadonlySet<number> | 'any';
    readonly hours: ReadonlySet<number> | 'any';
}

function parseCron(expr: string): ParsedCron | null {
    const parts = expr.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const minutes = parseField(parts[0], 0, 59);
    const hours = parseField(parts[1], 0, 23);
    if (!minutes || !hours) return null;
    return {minutes, hours};
}

function parseField(field: string, min: number, max: number): ReadonlySet<number> | 'any' | null {
    if (field === '*') return 'any';
    const out = new Set<number>();
    for (const piece of field.split(',')) {
        const stepMatch = piece.match(/^\*\/(\d+)$/);
        if (stepMatch) {
            const step = Number(stepMatch[1]);
            if (!Number.isFinite(step) || step <= 0) return null;
            for (let v = min; v <= max; v += step) out.add(v);
            continue;
        }
        const rangeMatch = piece.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
            const a = Number(rangeMatch[1]);
            const b = Number(rangeMatch[2]);
            if (!inRange(a, min, max) || !inRange(b, min, max) || a > b) return null;
            for (let v = a; v <= b; v++) out.add(v);
            continue;
        }
        const n = Number(piece);
        if (!inRange(n, min, max)) return null;
        out.add(n);
    }
    return out;
}

function inRange(n: number, min: number, max: number): boolean {
    return Number.isFinite(n) && n >= min && n <= max;
}

function matches(p: ParsedCron, m: number, h: number): boolean {
    const mOk = p.minutes === 'any' || p.minutes.has(m);
    const hOk = p.hours === 'any' || p.hours.has(h);
    return mOk && hOk;
}
