/**
 * Wave 8b — Compliance MCP tools.
 *
 *   compliance.dataExport.run     — operator-mediated user data export
 *   compliance.deletion.list      — pending deletion requests
 *   compliance.deletion.confirm   — flip a request to 'purged' early
 *                                   (the cron sweep does it on schedule;
 *                                   confirm is the operator-override)
 *   compliance.deletion.cancel    — undo a pending deletion request
 *   compliance.retention.sweep    — run the retention TTL sweep on demand
 *
 * Shape matches the F8-bulk reference: defineTool wrappers,
 * idempotent+auditScope on writes, predefined-enum input schemas.
 */
import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {getComplianceService} from '@services/features/Compliance/ComplianceService';
import type {FeatureContext} from '@services/infra/featureManifest';
import {defineTool} from './_shared';

interface ConnHandle {
    database?: unknown;
    cartRedis?: unknown;
    featureServices?: Record<string, unknown>;
    setupClient?: () => Promise<void>;
}

function db(): unknown {
    const conn = getMongoConnection() as unknown as ConnHandle;
    const d = conn.database;
    if (!d) throw new Error('Database not ready');
    return d;
}

function buildCtx(): FeatureContext {
    const conn = getMongoConnection() as unknown as ConnHandle;
    if (!conn.database) throw new Error('Database not ready');
    return {
        db: conn.database as never,
        redis: (conn.cartRedis ?? {}) as never,
        services: conn.featureServices ?? {},
        reconnect: conn.setupClient ?? (async () => undefined),
    };
}

export const complianceDataExportRun: McpTool = defineTool({
    // SAFE: read-only aggregation (returns the payload, doesn't mutate)
    name: 'compliance.dataExport.run',
    description: 'Generate a GDPR Article-20 data export for a single user. Returns the JSON manifest. Operator-mediated; audited.',
    scopes: ['read:users'],
    auditScope: 'compliance',
    inputSchema: {
        type: 'object',
        required: ['userId'],
        properties: {
            userId: {type: 'string', minLength: 1},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'compliance.dataExport.run');
    const svc = getComplianceService(db() as never);
    return svc.exportUserData(String(args.userId));
});

export const complianceDeletionList: McpTool = defineTool({
    // SAFE: read-only
    name: 'compliance.deletion.list',
    description: 'List pending account-deletion requests (newest first).',
    scopes: ['read:users'],
    inputSchema: {
        type: 'object',
        properties: {
            limit: {type: 'integer', minimum: 1, maximum: 500},
        },
    },
}, async (args) => {
    const svc = getComplianceService(db() as never);
    const limit = Math.min(500, Math.max(1, Number(args.limit ?? 100)));
    const rows = await svc.listPendingDeletions(limit);
    return {rows};
});

export const complianceDeletionConfirm: McpTool = defineTool({
    name: 'compliance.deletion.confirm',
    description: 'Operator-confirm a pending deletion request. The trash TTL already evaporates the per-row data within 24h of the soft-delete; confirm flips the DeletionRequests row to "purged" early so admin panes stop listing it. Idempotent + audited.',
    scopes: ['write:users'],
    idempotent: true,
    auditScope: 'compliance',
    inputSchema: {
        type: 'object',
        required: ['userId'],
        properties: {
            userId: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'compliance.deletion.confirm');
    const d = db() as {collection: (n: string) => {updateMany: (...a: never[]) => Promise<{modifiedCount?: number}>}};
    const res = await d.collection('DeletionRequests').updateMany(
        {userId: args.userId, status: 'pending'} as never,
        {$set: {status: 'purged', purgedAt: new Date().toISOString()}} as never,
    );
    return {modified: res.modifiedCount ?? 0};
});

export const complianceDeletionCancel: McpTool = defineTool({
    name: 'compliance.deletion.cancel',
    description: 'Cancel a pending account-deletion request (within the 30-day grace window). Note: this only flips the DeletionRequests row; restoring the soft-trashed user data requires a separate `trash.restore` call against the trashGroup the request captured.',
    scopes: ['write:users'],
    idempotent: true,
    auditScope: 'compliance',
    inputSchema: {
        type: 'object',
        required: ['userId'],
        properties: {
            userId: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'compliance.deletion.cancel');
    const svc = getComplianceService(db() as never);
    return svc.cancelDeletion(String(args.userId));
});

export const complianceRetentionSweep: McpTool = defineTool({
    name: 'compliance.retention.sweep',
    description: 'Run the retention TTL sweep on demand: marks expired DeletionRequests as purged + deletes rows older than the per-collection retention window in AuditLog / MarketingAttribution / Inquiries. Cron-callable; idempotent on the per-row basis (deletes are point-in-time cutoff-keyed).',
    scopes: ['write:users'],
    idempotent: true,
    auditScope: 'compliance',
    inputSchema: {
        type: 'object',
        properties: {
            idempotencyKey: {type: 'string'},
        },
    },
}, async (_args, ctx) => {
    await enforceModeForTool(ctx.actor, 'compliance.retention.sweep');
    void buildCtx; // reserved — kept for future per-tenant ctx threading
    const svc = getComplianceService(db() as never);
    return svc.runRetentionSweep();
});

export const COMPLIANCE_TOOLS: McpTool[] = [
    complianceDataExportRun,
    complianceDeletionList,
    complianceDeletionConfirm,
    complianceDeletionCancel,
    complianceRetentionSweep,
];
