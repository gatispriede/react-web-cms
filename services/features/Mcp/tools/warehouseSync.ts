/**
 * Phase 1.C — MCP tools for the `WarehousePageSyncWorker`.
 *
 * Five tools:
 *   - `pages.warehouseSync.run { adapterId? }`     — manual trigger
 *   - `pages.warehouseSync.status`                 — last-sync counts
 *   - `pages.warehouseSync.preview { adapterId, dryRun: true }` — what-if
 *   - `pages.warehouseSync.depth.get`              — soft-warning threshold
 *   - `pages.warehouseSync.depth.set { warningAt }` — adjust threshold
 *
 * The worker is wired into `PagesServiceLoader` at boot and exposed via
 * `getWarehouseSyncWorker()` — a getter the loader calls during
 * registration. Tests can override the getter via
 * `__setWarehouseSyncWorkerForTests` so the MCP surface is reachable
 * without a full feature-context bringup.
 */
import {McpTool} from '../types';
import {defineTool} from './_shared';
import type {WarehousePageSyncWorker, SyncResult} from '@services/features/Pages/WarehousePageSyncWorker';

// Module-scoped slot. Mutable so the loader can stamp its instance in
// during boot + so unit tests can inject a fake.
let workerRef: WarehousePageSyncWorker | null = null;

/** Called by PagesServiceLoader.onBoot() — stamps the live worker in. */
export function registerWarehouseSyncWorker(w: WarehousePageSyncWorker): void {
    workerRef = w;
}

/** Test seam — wipe the ref so each test starts clean. */
export function __setWarehouseSyncWorkerForTests(w: WarehousePageSyncWorker | null): void {
    workerRef = w;
}

function requireWorker(): WarehousePageSyncWorker {
    if (!workerRef) {
        throw new Error('WarehousePageSyncWorker not registered yet — boot order issue');
    }
    return workerRef;
}

// In-memory depth-warning threshold. Phase 0c reserved a `maxPageDepth`
// slot on ISiteFlags — but Phase 1.C ships a soft warning, not a hard
// cap, so this number lives in process memory and resets on reboot.
// The setter is admin-only (write:settings scope); the getter is read.
let depthWarningAt = 8;

export const pagesWarehouseSyncRun: McpTool = defineTool({
    name: 'pages.warehouseSync.run',
    description: 'Manually fires the `WarehousePageSyncWorker` for one or all registered warehouse adapters. Use BEFORE expecting freshly-imported products to surface in the page tree (the cron interval is 5 min — this skips the wait). Optional `adapterId` narrows the run to one adapter.',
    scopes: ['write:site'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        properties: {
            adapterId: {type: 'string', description: 'Restrict to one adapter id, e.g. "ss-com-cars". Omit to sync everything.'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args) => {
    const worker = requireWorker();
    const results: SyncResult[] = await worker.runNow({adapterId: args.adapterId});
    return {ok: true, results};
});

export const pagesWarehouseSyncStatus: McpTool = defineTool({
    name: 'pages.warehouseSync.status',
    description: 'Returns the last completed (non-dry-run) sync result — adapter id, timestamps, per-page counts (created / updated / softDeleted / skippedOperatorEdited / errors). Returns `{found:false}` if no sync has run yet this boot.',
    scopes: ['read:content'],
    inputSchema: {type: 'object', properties: {}},
}, async () => {
    const worker = requireWorker();
    const last = worker.getLastResult();
    if (!last) return {found: false};
    return {found: true, last};
});

export const pagesWarehouseSyncPreview: McpTool = defineTool({
    name: 'pages.warehouseSync.preview',
    description: 'Dry-run preview of a warehouse sync — computes the diff without writing. Returns the `perPage` outcome list so an operator can sanity-check before triggering a real run. `dryRun` is always true on this tool regardless of payload.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            adapterId: {type: 'string', description: 'Restrict to one adapter id. Omit to preview everything.'},
            dryRun: {type: 'boolean', description: 'Always true — parameter retained for API symmetry with `.run`.'},
        },
    },
}, async (args) => {
    const worker = requireWorker();
    const results = await worker.runNow({adapterId: args.adapterId, dryRun: true});
    return {ok: true, dryRun: true, results};
});

export const pagesWarehouseSyncDepthGet: McpTool = defineTool({
    name: 'pages.warehouseSync.depth.get',
    description: 'Returns the soft-warning threshold for page-tree depth. The admin shell raises a warning when an operator creates a sub-page deeper than this. Default 8.',
    scopes: ['read:content'],
    inputSchema: {type: 'object', properties: {}},
}, async () => ({warningAt: depthWarningAt}));

export const pagesWarehouseSyncDepthSet: McpTool = defineTool({
    name: 'pages.warehouseSync.depth.set',
    description: 'Adjust the soft-warning threshold for page-tree depth (default 8). Values < 1 reject. The threshold lives in process memory — set on each boot if you want a non-default value persisted across restarts.',
    scopes: ['write:site'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['warningAt'],
        properties: {
            warningAt: {type: 'integer', minimum: 1, maximum: 30, description: 'New soft-warning threshold. Recommended 6–12.'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args) => {
    const n = Number(args.warningAt);
    if (!Number.isFinite(n) || n < 1) {
        return {ok: false, error: 'INVALID_ARGS', message: 'warningAt must be >= 1'};
    }
    depthWarningAt = Math.floor(n);
    return {ok: true, warningAt: depthWarningAt};
});

export const WAREHOUSE_SYNC_TOOLS: McpTool[] = [
    pagesWarehouseSyncRun,
    pagesWarehouseSyncStatus,
    pagesWarehouseSyncPreview,
    pagesWarehouseSyncDepthGet,
    pagesWarehouseSyncDepthSet,
];
