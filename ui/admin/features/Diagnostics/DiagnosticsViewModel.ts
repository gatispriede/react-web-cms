import {observable} from '@client/lib/state/observable';
import {log} from '@services/infra/logger';

export interface BuildIdentity {
    gitSha: string;
    buildTimestamp: string | null;
    activeUpstream: string;
    bootId: string;
    uptimeMs: number;
    nodeEnv: string;
    deployTier: string;
}
export interface FeatureSummary {
    id: string;
    displayName: string;
    enabled: boolean;
    coreInfrastructure: boolean;
    mutationCount: number;
    queryCount: number;
    gatedMutationCount: number;
    cascadeRuleCount: number;
}
export interface StorageHealth {
    mongo: {connected: boolean; replicaSet: boolean; transactionsSupported: boolean};
    redis: {available: boolean; dbSize: number | null};
    cacheVersions: Record<string, number>;
}
export interface TrashOverview {
    collection: string;
    rowCount: number;
    oldestDeletedAt: string | null;
    distinctTrashGroups: number;
}
export interface DiagnosticsSnapshot {
    build: BuildIdentity;
    features: FeatureSummary[];
    storage: StorageHealth;
    trash: TrashOverview[];
    idempotency: {inFlight: number; ttlSeconds: number};
    authorization: {
        grantsByScope: Record<string, number>;
        functionalRolesRegistered: number;
        grantTotal: number;
    };
    generatedAt: string;
}

export interface RouteProbe {
    path: string;
    status: number | null;
    ms: number;
    error?: string;
}

const DEFAULT_PROBE_PATHS = [
    '/admin/build',
    '/admin/system/users',
    '/admin/system/info',
    '/admin/release/audit',
    '/api/health',
    '/api/graphql',
    '/api/info',
];

async function fetchSnapshot(): Promise<DiagnosticsSnapshot | {error: string}> {
    try {
        const r = await fetch('/api/graphql', {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({query: `{ mongo { getDiagnostics } }`}),
        });
        const json = await r.json();
        const raw = json?.data?.mongo?.getDiagnostics;
        if (!raw) return {error: 'empty payload'};
        return JSON.parse(raw) as DiagnosticsSnapshot;
    } catch (err) {
        log.error({scope: 'diagnostics.fetch', err}, 'diagnostics fetch failed');
        return {error: String(err)};
    }
}

async function probe(path: string): Promise<RouteProbe> {
    const start = performance.now();
    try {
        const res = await fetch(path, {method: 'HEAD', credentials: 'same-origin', cache: 'no-store'});
        return {path, status: res.status, ms: Math.round(performance.now() - start)};
    } catch (err) {
        return {path, status: null, ms: Math.round(performance.now() - start), error: String(err)};
    }
}

/**
 * F5 — Diagnostics admin pane VM. VM3 (no `useState`).
 *
 * `refresh()` re-pulls the server snapshot; `runRouteProbes()` fans out
 * client-side HEAD probes in parallel via `Promise.allSettled`. Both
 * are user-triggered — there is no auto-refresh per the locked spec.
 */
export class DiagnosticsViewModel {
    loading = false;
    data: DiagnosticsSnapshot | null = null;
    lastFetchedAt: Date | null = null;
    error: string | null = null;
    probes: RouteProbe[] = [];
    probesRunning = false;

    constructor() { return observable(this); }

    async refresh(): Promise<void> {
        this.loading = true;
        this.error = null;
        try {
            const result = await fetchSnapshot();
            if ('error' in result) {
                this.error = result.error;
                this.data = null;
            } else {
                this.data = result;
            }
            this.lastFetchedAt = new Date();
        } finally {
            this.loading = false;
        }
    }

    async runRouteProbes(paths: readonly string[] = DEFAULT_PROBE_PATHS): Promise<void> {
        this.probesRunning = true;
        try {
            const settled = await Promise.allSettled(paths.map(probe));
            this.probes = settled.map((s, i) => s.status === 'fulfilled'
                ? s.value
                : {path: paths[i], status: null, ms: 0, error: String(s.reason)},
            );
        } finally {
            this.probesRunning = false;
        }
    }
}
