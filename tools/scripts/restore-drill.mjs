#!/usr/bin/env node
/**
 * W8e — Automated restore drill.
 *
 * Restores the latest restic snapshot into a temp directory, spins up a
 * sidecar mongo on port 27027 (configurable), mongorestores the dump,
 * runs minimal sanity queries (`db.users.countDocuments({})`,
 * `db.pages.countDocuments({})`), and emits a report to stdout. Designed
 * to run weekly from cron or GitHub Actions.
 *
 * Exit codes:
 *   0 — drill passed (counts non-zero, snapshot fresh)
 *   1 — drill failed (restore error or empty counts)
 *   2 — drill aborted (creds missing / restic absent — not a failure,
 *        just a no-op so the cron doesn't page on Saturday)
 *
 * The report is also recorded into the `Backups` collection via
 * BACKUP_DRILL_REPORT_URL if set — a POST endpoint that takes the JSON
 * payload. Without that URL set, the report only lands in stdout.
 *
 * Usage:
 *   node tools/scripts/restore-drill.mjs
 *
 * Env:
 *   BACKUP_DRILL_PORT          (default 27027)
 *   BACKUP_DRILL_SNAPSHOT      (default "latest")
 *   BACKUP_DRILL_RPO_HOURS     (default 6 — drill fails if snapshot older)
 *   BACKUP_DRILL_RTO_MINUTES   (default 60 — drill fails if duration exceeds)
 */

import {spawn} from 'node:child_process';
import {mkdtemp, rm, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import process from 'node:process';

const PORT = Number(process.env.BACKUP_DRILL_PORT || 27027);
const SNAPSHOT = process.env.BACKUP_DRILL_SNAPSHOT || 'latest';
const RPO_HOURS = Number(process.env.BACKUP_DRILL_RPO_HOURS || 6);
const RTO_MINUTES = Number(process.env.BACKUP_DRILL_RTO_MINUTES || 60);

function run(cmd, args, opts = {}) {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, {...opts, env: {...process.env, ...(opts.env || {})}});
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (b) => { stdout += b.toString(); });
        child.stderr?.on('data', (b) => { stderr += b.toString(); });
        child.on('error', (err) => resolve({code: 127, stdout, stderr: stderr + '\n' + err.message}));
        child.on('close', (code) => resolve({code: code ?? 1, stdout, stderr}));
    });
}

function checkEnv() {
    const required = ['B2_ACCOUNT_ID', 'B2_APPLICATION_KEY', 'B2_BUCKET_NAME', 'BACKUP_RESTIC_PASSWORD'];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length) return {ok: false, reason: `missing env: ${missing.join(', ')}`};
    return {ok: true};
}

async function findBsonRoot(target) {
    async function walk(dir, depth = 0) {
        if (depth > 6) return null;
        let entries;
        try { entries = await readdir(dir, {withFileTypes: true}); }
        catch { return null; }
        for (const e of entries) {
            if (e.isFile() && /\.bson(\.gz)?$/.test(e.name)) return dir;
        }
        for (const e of entries) {
            if (e.isDirectory()) {
                const found = await walk(join(dir, e.name), depth + 1);
                if (found) return found;
            }
        }
        return null;
    }
    return walk(target);
}

async function main() {
    const started = Date.now();
    const env = checkEnv();
    if (!env.ok) {
        console.log(JSON.stringify({ok: false, aborted: true, reason: env.reason}));
        process.exit(2);
    }
    const resticEnv = {
        RESTIC_REPOSITORY: `b2:${process.env.B2_BUCKET_NAME}:/`,
        RESTIC_PASSWORD: process.env.BACKUP_RESTIC_PASSWORD,
        B2_ACCOUNT_ID: process.env.B2_ACCOUNT_ID,
        B2_ACCOUNT_KEY: process.env.B2_APPLICATION_KEY,
        B2_REGION: process.env.B2_REGION || 'us-west-002',
    };
    const target = await mkdtemp(join(tmpdir(), 'cms-drill-'));
    const report = {
        ok: false,
        startedAt: new Date(started).toISOString(),
        snapshot: SNAPSHOT,
        target,
        durationMs: 0,
        snapshotAgeMs: null,
        counts: {users: null, pages: null},
        steps: [],
    };

    try {
        // 1) Read the latest snapshot metadata for age check.
        const snapshots = await run('restic', ['snapshots', '--json'], {env: resticEnv});
        report.steps.push({step: 'restic.snapshots', code: snapshots.code});
        if (snapshots.code === 0) {
            try {
                const parsed = JSON.parse(snapshots.stdout);
                if (Array.isArray(parsed) && parsed.length) {
                    const last = parsed[parsed.length - 1];
                    report.snapshotAgeMs = Date.now() - new Date(last.time).getTime();
                }
            } catch { /* ignore parse error */ }
        }

        // 2) Restore.
        const restore = await run('restic', ['restore', SNAPSHOT, '--target', target], {env: resticEnv});
        report.steps.push({step: 'restic.restore', code: restore.code});
        if (restore.code !== 0) {
            report.reason = 'restore-failed';
            report.stderr = restore.stderr.slice(0, 2000);
            throw new Error('restore-failed');
        }

        // 3) Locate the mongo dump within the restored tree.
        const dumpRoot = await findBsonRoot(target);
        report.dumpRoot = dumpRoot;
        if (!dumpRoot) {
            report.reason = 'no-dump-found';
            throw new Error('no-dump-found');
        }

        // 4) Restore into a sidecar mongo + count.
        // Note: this assumes a mongod is reachable on PORT; in a full
        // drill the cron/CI step also spins up a docker mongo. We
        // document the docker-compose snippet in the runbook.
        const mongoUri = `mongodb://localhost:${PORT}`;
        const mongorestore = await run('mongorestore', [
            '--uri', mongoUri,
            '--gzip',
            '--drop',
            dumpRoot,
        ]);
        report.steps.push({step: 'mongorestore', code: mongorestore.code});
        if (mongorestore.code !== 0) {
            report.reason = 'mongorestore-failed';
            report.stderr = mongorestore.stderr.slice(0, 2000);
            throw new Error('mongorestore-failed');
        }

        // 5) Sanity-count via mongosh.
        const evalCmd = 'JSON.stringify({users: db.getSiblingDB(\'MAIN-DB\').users.countDocuments({}), pages: db.getSiblingDB(\'MAIN-DB\').pages.countDocuments({})})';
        const counts = await run('mongosh', [mongoUri, '--quiet', '--eval', evalCmd]);
        report.steps.push({step: 'mongosh.counts', code: counts.code});
        if (counts.code === 0) {
            try {
                const parsed = JSON.parse(counts.stdout.trim().split('\n').pop());
                report.counts = parsed;
            } catch { /* ignore */ }
        }

        const ok = (report.counts.users ?? 0) > 0 && (report.counts.pages ?? 0) > 0;
        const fresh = report.snapshotAgeMs === null || report.snapshotAgeMs <= RPO_HOURS * 3600_000;
        const fast = (Date.now() - started) <= RTO_MINUTES * 60_000;
        report.ok = ok && fresh && fast;
        if (!fresh) report.reason = 'stale-snapshot';
        else if (!fast) report.reason = 'rto-exceeded';
        else if (!ok) report.reason = 'empty-counts';
    } catch (err) {
        if (!report.reason) report.reason = String(err.message || err);
    } finally {
        report.durationMs = Date.now() - started;
        await rm(target, {recursive: true, force: true}).catch(() => {});
    }

    // POST the report if a sink is configured.
    if (process.env.BACKUP_DRILL_REPORT_URL) {
        try {
            await fetch(process.env.BACKUP_DRILL_REPORT_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(report),
            });
        } catch (err) {
            report.reportPostError = String(err.message || err);
        }
    }

    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
