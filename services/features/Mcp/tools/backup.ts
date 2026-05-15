/**
 * W8e — Backup MCP tools.
 *
 * Wraps the BackupService methods (via the connection delegate). Restore
 * is intentionally gated to a staging target — the prod-overwrite restore
 * is operator-only via the runbook (`docs/runbooks/backup-and-restore.md`)
 * so a misfired tool call can't wipe live data.
 */
import {McpTool} from '../types';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool} from './_shared';

interface BackupServiceLike {
    backupNow(opts?: {label?: string; actor?: string}): Promise<unknown>;
    listSnapshots(): Promise<unknown>;
    verifyLatest(opts?: {actor?: string}): Promise<unknown>;
    restoreSnapshot(id: string, target: string, opts?: {actor?: string}): Promise<unknown>;
    lastDrill(): Promise<unknown>;
}

function svc(): BackupServiceLike | undefined {
    const conn = getMongoConnection() as unknown as {featureServices?: Record<string, unknown>};
    return conn.featureServices?.backup as BackupServiceLike | undefined;
}

export const backupList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'backup.list',
    description: 'List the latest restic snapshots in the backup repo (id, time, size, tags).',
    scopes: ['read:audit'],
    inputSchema: {type: 'object', properties: {}},
}, async () => {
    const s = svc();
    if (!s) return {ok: false, error: 'backup-service-unavailable'};
    return s.listSnapshots();
});

export const backupNow: McpTool = defineTool({
    name: 'backup.now',
    description: 'Trigger an immediate restic backup (mongo dump + uploads). Returns snapshot id, size, duration.',
    scopes: ['write:site'],
    idempotent: true,
    rateLimit: {maxPerMinute: 4},
    inputSchema: {
        type: 'object',
        properties: {
            label: {type: 'string'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'backup.now');
    const s = svc();
    if (!s) return {ok: false, error: 'backup-service-unavailable'};
    return s.backupNow({
        label: typeof args.label === 'string' ? args.label : undefined,
        actor: ctx.actor ?? 'mcp',
    });
});

export const backupVerify: McpTool = defineTool({
    name: 'backup.verify',
    description: 'Run `restic check --read-data-subset=5%` to verify repository integrity.',
    scopes: ['read:audit'],
    rateLimit: {maxPerMinute: 2},
    inputSchema: {type: 'object', properties: {}},
}, async (_args, ctx) => {
    await enforceModeForTool(ctx.actor, 'backup.verify');
    const s = svc();
    if (!s) return {ok: false, error: 'backup-service-unavailable'};
    return s.verifyLatest({actor: ctx.actor ?? 'mcp'});
});

export const backupRestoreToStaging: McpTool = defineTool({
    name: 'backup.restoreToStaging',
    description: 'Restore a snapshot to a sandbox temp directory (NOT prod). Returns the restored target path + mongo dump location.',
    scopes: ['write:site'],
    idempotent: true,
    rateLimit: {maxPerMinute: 2},
    inputSchema: {
        type: 'object',
        required: ['snapshotId'],
        properties: {
            snapshotId: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'backup.restoreToStaging');
    const s = svc();
    if (!s) return {ok: false, error: 'backup-service-unavailable'};
    const os = await import('node:os');
    const pathMod = await import('node:path');
    const fs = await import('node:fs/promises');
    const target = await fs.mkdtemp(pathMod.join(os.tmpdir(), 'cms-restore-staging-'));
    return s.restoreSnapshot(String(args.snapshotId), target, {actor: ctx.actor ?? 'mcp'});
});

export const backupLastDrillResult: McpTool = defineTool({
    name: 'backup.lastDrillResult',
    description: 'Return the most recent automated restore-drill result (pass/fail, duration, snapshot age).',
    scopes: ['read:audit'],
    inputSchema: {type: 'object', properties: {}},
}, async () => {
    const s = svc();
    if (!s) return {ok: false, error: 'backup-service-unavailable'};
    return {drill: await s.lastDrill()};
});

export const BACKUP_TOOLS: McpTool[] = [
    backupList,
    backupNow,
    backupVerify,
    backupRestoreToStaging,
    backupLastDrillResult,
];
