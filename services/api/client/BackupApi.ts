import {resolve} from '@services/api/generated';
import {log} from '@services/infra/logger';

/**
 * W8e — Admin-side client for the backup feature.
 *
 * Mirrors the BackupService surface over GraphQL. All payloads come back
 * as JSON-stringified envelopes (per the wider `mongoDBConnection`
 * pattern) — `parse()` unwraps them with a safe fallback.
 */

export interface BackupStatus {
    last: Record<string, unknown> | null;
    lastDrill: Record<string, unknown> | null;
    history: Array<Record<string, unknown>>;
}

export interface BackupSnapshotRow {
    id: string;
    time: string;
    paths: string[];
    tags: string[];
    hostname: string;
    sizeBytes?: number;
}

export interface BackupSnapshots {
    ok: boolean;
    reason?: string;
    snapshots: BackupSnapshotRow[];
}

export interface BackupOpResult {
    ok: boolean;
    reason?: string;
    snapshotId?: string;
    sizeBytes?: number;
    durationMs: number;
    log?: string;
    target?: string;
    mongoDumpPath?: string;
}

function parse<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; }
    catch { return fallback; }
}

export class BackupApi {
    async status(): Promise<BackupStatus> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.backupStatus());
            return parse<BackupStatus>(raw, {last: null, lastDrill: null, history: []});
        } catch (err) {
            log.error({scope: 'backup.status', err}, 'backup status fetch failed');
            return {last: null, lastDrill: null, history: []};
        }
    }

    async listSnapshots(): Promise<BackupSnapshots> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.backupListSnapshots());
            return parse<BackupSnapshots>(raw, {ok: false, snapshots: []});
        } catch (err) {
            log.error({scope: 'backup.list', err}, 'snapshot list failed');
            return {ok: false, snapshots: []};
        }
    }

    async backupNow(label?: string): Promise<BackupOpResult> {
        try {
            const raw = await resolve(({mutation}) =>
                (mutation as any).mongo.backupNow(label ? {label} : {}),
            );
            return parse<BackupOpResult>(raw, {ok: false, reason: 'no-response', durationMs: 0});
        } catch (err) {
            return {ok: false, reason: String(err), durationMs: 0};
        }
    }

    async verify(): Promise<BackupOpResult> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.backupVerify());
            return parse<BackupOpResult>(raw, {ok: false, reason: 'no-response', durationMs: 0});
        } catch (err) {
            return {ok: false, reason: String(err), durationMs: 0};
        }
    }

    async restoreToStaging(snapshotId: string): Promise<BackupOpResult> {
        try {
            const raw = await resolve(({mutation}) =>
                (mutation as any).mongo.backupRestoreToStaging({snapshotId}),
            );
            return parse<BackupOpResult>(raw, {ok: false, reason: 'no-response', durationMs: 0});
        } catch (err) {
            return {ok: false, reason: String(err), durationMs: 0};
        }
    }
}

export default BackupApi;
