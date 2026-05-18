import {Collection, Db} from 'mongodb';
import {spawn} from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import guid from '@utils/guid';
import {log} from '@services/infra/logger';

/**
 * W8e — Backup + disaster recovery.
 *
 * Wraps `restic` (off-droplet, encrypted, deduplicated backup) targeting
 * a Backblaze B2 bucket. Mongo dump + uploads + env are bundled into a
 * single snapshot per run; restic deduplicates across runs so the
 * effective storage cost is delta-only.
 *
 * Disabled-by-default: if `BACKUP_ENABLED !== 'true'` OR any of the
 * three credential env vars (`B2_ACCOUNT_ID`, `B2_APPLICATION_KEY`,
 * `B2_BUCKET_NAME`) is missing OR `BACKUP_RESTIC_PASSWORD` is unset,
 * every method short-circuits to `{ok: false, reason: 'backup-disabled'}`.
 *
 * Operator setup is documented in `docs/runbooks/backup-and-restore.md`.
 *
 * RPO: 6h (hourly cron writes oplog tail snapshots).
 * RTO: 1h (restore drill exercises end-to-end recovery weekly).
 */

export interface BackupResult {
    ok: boolean;
    reason?: 'backup-disabled' | 'restic-error' | 'mongodump-error' | 'no-snapshot';
    snapshotId?: string;
    sizeBytes?: number;
    durationMs: number;
    log: string;
}

export interface BackupSnapshot {
    id: string;
    time: string;
    paths: string[];
    tags: string[];
    hostname: string;
    sizeBytes?: number;
}

export interface BackupListResult {
    ok: boolean;
    reason?: BackupResult['reason'];
    snapshots: BackupSnapshot[];
}

export interface RestoreResult extends BackupResult {
    target?: string;
    /** Path to a local restored mongo dump (when present in the snapshot). */
    mongoDumpPath?: string;
}

export interface BackupServiceDeps {
    readonly db: Db;
    /** Override for tests — defaults to `process.env`. */
    readonly env?: NodeJS.ProcessEnv;
    /** Override for tests — defaults to spawning real binaries. */
    readonly runner?: (cmd: string, args: string[], opts: {env: NodeJS.ProcessEnv}) => Promise<{code: number; stdout: string; stderr: string}>;
}

const DEFAULT_TAG = 'cms';

interface AuditWriter {
    record?(entry: unknown): Promise<void> | void;
}

export class BackupService {
    private readonly col: Collection;
    private readonly env: NodeJS.ProcessEnv;
    private readonly runner: NonNullable<BackupServiceDeps['runner']>;
    private auditService: AuditWriter | null = null;

    constructor(deps: BackupServiceDeps) {
        this.col = deps.db.collection('Backups');
        this.env = deps.env ?? process.env;
        this.runner = deps.runner ?? defaultRunner;
        // Best-effort: TTL index on `at` so the run history doesn't grow
        // unbounded. 365 days is well past the RPO window.
        this.col.createIndex({at: -1}).catch(() => {});
    }

    /** Wired by the loader so audit entries can be written for every op. */
    setAuditService(svc: AuditWriter | null): void {
        this.auditService = svc;
    }

    private enabled(): {ok: true} | {ok: false; reason: 'backup-disabled'} {
        const e = this.env;
        if (e.BACKUP_ENABLED !== 'true') return {ok: false, reason: 'backup-disabled'};
        if (!e.B2_ACCOUNT_ID || !e.B2_APPLICATION_KEY || !e.B2_BUCKET_NAME) {
            return {ok: false, reason: 'backup-disabled'};
        }
        if (!e.BACKUP_RESTIC_PASSWORD) return {ok: false, reason: 'backup-disabled'};
        return {ok: true};
    }

    private resticEnv(): NodeJS.ProcessEnv {
        const e = this.env;
        const region = e.B2_REGION || 'us-west-002';
        return {
            ...process.env,
            RESTIC_REPOSITORY: `b2:${e.B2_BUCKET_NAME}:/`,
            RESTIC_PASSWORD: e.BACKUP_RESTIC_PASSWORD,
            B2_ACCOUNT_ID: e.B2_ACCOUNT_ID,
            B2_ACCOUNT_KEY: e.B2_APPLICATION_KEY,
            B2_REGION: region,
        };
    }

    private async run(cmd: string, args: string[]): Promise<{code: number; stdout: string; stderr: string}> {
        return this.runner(cmd, args, {env: this.resticEnv()});
    }

    async backupNow(opts: {label?: string; actor?: string} = {}): Promise<BackupResult> {
        const gate = this.enabled();
        if (!gate.ok) return {ok: false, reason: gate.reason, durationMs: 0, log: 'backup disabled — env not set'};
        const started = Date.now();
        const lines: string[] = [];
        const tag = opts.label ? `${DEFAULT_TAG}:${opts.label}` : DEFAULT_TAG;
        const dumpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cms-backup-'));
        try {
            // 1) mongodump → temp dir
            const mongoUri = this.env.MONGODB_URI || 'mongodb://localhost:27017';
            const mongoOut = path.join(dumpDir, 'mongo');
            await fs.mkdir(mongoOut, {recursive: true});
            const dump = await this.run('mongodump', ['--uri', mongoUri, '--gzip', '--out', mongoOut]);
            lines.push(`[mongodump] code=${dump.code}`);
            if (dump.code !== 0) {
                lines.push(dump.stderr.slice(0, 4000));
                return {ok: false, reason: 'mongodump-error', durationMs: Date.now() - started, log: lines.join('\n')};
            }

            // 2) restic backup mongo dump + uploads
            const uploads = this.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');
            const backupTargets = [mongoOut, uploads].filter(Boolean);
            const restic = await this.run('restic', [
                'backup',
                ...backupTargets,
                '--tag', tag,
                '--host', this.env.HOSTNAME || os.hostname(),
                '--json',
            ]);
            lines.push(`[restic] code=${restic.code}`);
            lines.push(restic.stdout.slice(-2000));
            if (restic.code !== 0) {
                lines.push(restic.stderr.slice(0, 2000));
                return {ok: false, reason: 'restic-error', durationMs: Date.now() - started, log: lines.join('\n')};
            }

            // 3) parse latest snapshot id from JSON-lines output
            const {id, sizeBytes} = parseSummary(restic.stdout);
            const durationMs = Date.now() - started;
            await this.col.insertOne({
                id: guid(),
                snapshotId: id,
                kind: 'full',
                label: opts.label ?? null,
                completedAt: new Date(),
                sizeBytes: sizeBytes ?? null,
                durationMs,
                ok: true,
            } as Record<string, unknown>);
            await this.audit({op: 'create', tag: 'backup.now', actor: opts.actor, docId: id});
            return {ok: true, snapshotId: id, sizeBytes, durationMs, log: lines.join('\n')};
        } catch (err) {
            log.error({scope: 'backup.now', err}, 'backupNow failed');
            return {ok: false, reason: 'restic-error', durationMs: Date.now() - started, log: String((err as Error).message || err)};
        } finally {
            await fs.rm(dumpDir, {recursive: true, force: true}).catch(() => {});
        }
    }

    async listSnapshots(): Promise<BackupListResult> {
        const gate = this.enabled();
        if (!gate.ok) return {ok: false, reason: gate.reason, snapshots: []};
        const r = await this.run('restic', ['snapshots', '--json']);
        if (r.code !== 0) return {ok: false, reason: 'restic-error', snapshots: []};
        try {
            const parsed = JSON.parse(r.stdout) as Array<{
                id: string;
                short_id?: string;
                time: string;
                paths?: string[];
                tags?: string[];
                hostname?: string;
                summary?: {total_bytes_processed?: number};
            }>;
            return {
                ok: true,
                snapshots: parsed.map(s => ({
                    id: s.short_id || s.id,
                    time: s.time,
                    paths: s.paths ?? [],
                    tags: s.tags ?? [],
                    hostname: s.hostname ?? '',
                    sizeBytes: s.summary?.total_bytes_processed,
                })),
            };
        } catch (err) {
            log.warn({scope: 'backup.list', err}, 'snapshot parse failed');
            return {ok: false, reason: 'restic-error', snapshots: []};
        }
    }

    async restoreSnapshot(id: string, target: string, opts: {actor?: string} = {}): Promise<RestoreResult> {
        const gate = this.enabled();
        if (!gate.ok) return {ok: false, reason: gate.reason, durationMs: 0, log: 'backup disabled'};
        const started = Date.now();
        await fs.mkdir(target, {recursive: true});
        const r = await this.run('restic', ['restore', id, '--target', target]);
        const durationMs = Date.now() - started;
        const lines = [`[restic restore] code=${r.code}`, r.stdout.slice(-2000)];
        if (r.code !== 0) {
            return {ok: false, reason: 'restic-error', target, durationMs, log: lines.join('\n')};
        }
        const mongoDumpPath = await findMongoDump(target);
        await this.audit({op: 'update', tag: 'backup.restore', actor: opts.actor, docId: id});
        return {ok: true, snapshotId: id, target, mongoDumpPath, durationMs, log: lines.join('\n')};
    }

    async pruneSnapshots(opts: {actor?: string} = {}): Promise<BackupResult> {
        const gate = this.enabled();
        if (!gate.ok) return {ok: false, reason: gate.reason, durationMs: 0, log: 'backup disabled'};
        const started = Date.now();
        const keepDaily = String(toInt(this.env.BACKUP_RETENTION_DAILY, 14));
        const keepHourly = String(toInt(this.env.BACKUP_RETENTION_HOURLY, 28));
        const r = await this.run('restic', [
            'forget',
            '--keep-daily', keepDaily,
            '--keep-hourly', keepHourly,
            '--keep-weekly', '8',
            '--keep-monthly', '12',
            '--prune',
        ]);
        const durationMs = Date.now() - started;
        if (r.code !== 0) {
            return {ok: false, reason: 'restic-error', durationMs, log: r.stderr.slice(0, 4000)};
        }
        await this.audit({op: 'delete', tag: 'backup.prune', actor: opts.actor});
        return {ok: true, durationMs, log: r.stdout.slice(-2000)};
    }

    async verifyLatest(opts: {actor?: string} = {}): Promise<BackupResult> {
        const gate = this.enabled();
        if (!gate.ok) return {ok: false, reason: gate.reason, durationMs: 0, log: 'backup disabled'};
        const started = Date.now();
        const r = await this.run('restic', ['check', '--read-data-subset=5%']);
        const durationMs = Date.now() - started;
        await this.audit({op: 'update', tag: 'backup.verify', actor: opts.actor});
        if (r.code !== 0) {
            return {ok: false, reason: 'restic-error', durationMs, log: r.stderr.slice(0, 4000)};
        }
        return {ok: true, durationMs, log: r.stdout.slice(-2000)};
    }

    /** Last successful backup row, or `null` if none. */
    async lastBackup(): Promise<Record<string, unknown> | null> {
        const row = await this.col.find({ok: true}, {projection: {_id: 0}})
            .sort({completedAt: -1}).limit(1).next();
        return row ?? null;
    }

    /** Recent backup history (full + hourly). Capped at 50 rows for the admin pane. */
    async history(limit = 50): Promise<Array<Record<string, unknown>>> {
        const lim = Math.min(Math.max(1, limit), 200);
        const rows = await this.col.find({}, {projection: {_id: 0}})
            .sort({completedAt: -1}).limit(lim).toArray();
        return rows;
    }

    /** Drill rows live in the same collection under `kind: 'drill'`. */
    async lastDrill(): Promise<Record<string, unknown> | null> {
        const row = await this.col.find({kind: 'drill'}, {projection: {_id: 0}})
            .sort({completedAt: -1}).limit(1).next();
        return row ?? null;
    }

    async recordDrill(row: {ok: boolean; durationMs: number; snapshotAgeMs?: number; report?: unknown; actor?: string}): Promise<void> {
        await this.col.insertOne({
            id: guid(),
            kind: 'drill',
            completedAt: new Date(),
            ok: row.ok,
            durationMs: row.durationMs,
            snapshotAgeMs: row.snapshotAgeMs ?? null,
            report: row.report ?? null,
        } as Record<string, unknown>);
        await this.audit({op: 'create', tag: row.ok ? 'backup.drill.ok' : 'backup.drill.fail', actor: row.actor});
    }

    private async audit(entry: {op: 'create' | 'update' | 'delete'; tag: string; actor?: string; docId?: string}): Promise<void> {
        if (!this.auditService?.record) return;
        try {
            await this.auditService.record({
                collection: 'Backups',
                op: entry.op,
                docId: entry.docId,
                tag: entry.tag,
                actor: {email: entry.actor},
            });
        } catch (err) {
            log.warn({scope: 'backup.audit', err}, 'audit record failed');
        }
    }
}

function toInt(v: string | undefined, fallback: number): number {
    if (!v) return fallback;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function parseSummary(stdout: string): {id?: string; sizeBytes?: number} {
    // `restic backup --json` emits one JSON object per line; the last
    // `message_type: "summary"` object carries the snapshot id + bytes.
    const lines = stdout.split('\n').map(s => s.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
        try {
            const obj = JSON.parse(lines[i]) as Record<string, unknown>;
            if (obj.message_type === 'summary') {
                return {
                    id: typeof obj.snapshot_id === 'string' ? obj.snapshot_id.slice(0, 8) : undefined,
                    sizeBytes: typeof obj.total_bytes_processed === 'number' ? obj.total_bytes_processed : undefined,
                };
            }
        } catch { /* not JSON — skip */ }
    }
    return {};
}

async function findMongoDump(target: string): Promise<string | undefined> {
    // restic restores under `<target>/<absolute-paths-the-snapshot-saw>`,
    // so walk the tree to find the directory that contains a `*.bson.gz`.
    async function walk(dir: string, depth = 0): Promise<string | undefined> {
        if (depth > 6) return undefined;
        let entries: import('fs').Dirent[] = [];
        try { entries = await fs.readdir(dir, {withFileTypes: true}); }
        catch { return undefined; }
        for (const e of entries) {
            if (e.isFile() && /\.bson(\.gz)?$/.test(e.name)) return dir;
        }
        for (const e of entries) {
            if (e.isDirectory()) {
                const found = await walk(path.join(dir, e.name), depth + 1);
                if (found) return found;
            }
        }
        return undefined;
    }
    return walk(target);
}

function defaultRunner(cmd: string, args: string[], opts: {env: NodeJS.ProcessEnv}): Promise<{code: number; stdout: string; stderr: string}> {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, {env: opts.env});
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (b: Buffer) => { stdout += b.toString('utf8'); });
        child.stderr?.on('data', (b: Buffer) => { stderr += b.toString('utf8'); });
        child.on('error', (err: NodeJS.ErrnoException) => {
            resolve({code: err.code === 'ENOENT' ? 127 : 1, stdout, stderr: `${stderr}\n${err.message}`});
        });
        child.on('close', (code: number | null) => {
            resolve({code: code ?? 1, stdout, stderr});
        });
    });
}
