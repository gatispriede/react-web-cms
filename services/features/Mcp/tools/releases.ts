/**
 * MCP release tools — first-class Content Releases over MCP.
 *
 *   release.list       — list every release (optional status filter)
 *   release.get        — full document (including member snapshots)
 *   release.create     — empty release
 *   release.update     — patch title / description / scheduledFor
 *   release.delete     — drop a release (only when not publishing)
 *   release.attach     — attach an entity draft as a release member
 *                        (accepts a single `member` OR an `items[]`
 *                        F8-bulk batch)
 *   release.detach     — remove a member by (entity,id)
 *   release.publish    — atomic flip of all members to live
 *   release.rollback   — clone reverse snapshots into a new release,
 *                        auto-publish it, mark the original rolled-back
 *   release.previewAt  — compose "site state at this release's
 *                        perspective" — currently returns the member
 *                        list; full iframe preview is a follow-up
 *
 * Scope model:
 *   - read tools  → `read:content`
 *   - write tools → `write:content`
 *   - publish / rollback also pass `write:content`; they're guarded
 *     by `idempotent: true` so accidental double-publish via retried
 *     MCP calls short-circuits.
 */

import {McpTool} from '../types';
import {defineTool, runBatch} from './_shared';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {RELEASE_ENTITY_KINDS, RELEASE_STATUSES} from '@interfaces/IRelease';

const releaseService = () => getMongoConnection().releaseService;

const ENTITY_ENUM = RELEASE_ENTITY_KINDS as unknown as string[];
const STATUS_ENUM = RELEASE_STATUSES as unknown as string[];

// ─── Read ────────────────────────────────────────────────────────

export const releaseList: McpTool = defineTool({
    name: 'release.list',
    description: 'List every Content Release with status, member count, and timestamps. Optional `status` filter (one of draft / publishing / published / failed / rolled-back).',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            status: {type: 'string', enum: STATUS_ENUM, description: 'Filter to a single release status.'},
        },
    },
}, async (args) => {
    return releaseService().list({status: args.status});
});

export const releaseGet: McpTool = defineTool({
    name: 'release.get',
    description: 'Fetch a single release by id — includes every member with its frozen snapshot + pre-release snapshot.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {id: {type: 'string'}},
    },
}, async (args) => {
    const r = await releaseService().get(String(args.id));
    if (!r) throw new Error(`release not found: ${args.id}`);
    return r;
});

export const releasePreviewAt: McpTool = defineTool({
    name: 'release.previewAt',
    description: 'Compose "site state at this release\'s perspective" — what would publish if this release went live right now. Currently returns the release\'s member list; the iframe preview wiring is a follow-up.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {id: {type: 'string'}},
    },
}, async (args) => {
    return releaseService().previewAt(String(args.id));
});

// ─── Write ───────────────────────────────────────────────────────

export const releaseCreate: McpTool = defineTool({
    name: 'release.create',
    description: 'Create an empty Content Release in `draft` status. Returns the new release.',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['title'],
        properties: {
            title: {type: 'string', minLength: 1},
            description: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    return releaseService().create({
        title: String(args.title),
        description: typeof args.description === 'string' ? args.description : undefined,
        actor: ctx.actor,
    });
});

export const releaseUpdate: McpTool = defineTool({
    name: 'release.update',
    description: 'Patch a release\'s title / description / scheduledFor. OCC via `expectedVersion` — pass the version you read; mismatch throws.',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string'},
            title: {type: 'string'},
            description: {type: 'string'},
            scheduledFor: {type: 'string', description: 'ISO timestamp.'},
            expectedVersion: {type: 'integer', minimum: 1},
        },
    },
}, async (args) => {
    const patch: Record<string, unknown> = {};
    if (typeof args.title === 'string') patch.title = args.title;
    if (typeof args.description === 'string') patch.description = args.description;
    if (typeof args.scheduledFor === 'string') patch.scheduledFor = args.scheduledFor;
    return releaseService().update(
        String(args.id),
        patch as any,
        typeof args.expectedVersion === 'number' ? args.expectedVersion : undefined,
    );
});

export const releaseDelete: McpTool = defineTool({
    name: 'release.delete',
    description: 'Delete a release. Only allowed when the release is not currently publishing.',
    scopes: ['write:content'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args) => {
    await releaseService().delete(String(args.id));
    return {deleted: true, id: args.id};
});

// ─── Members ─────────────────────────────────────────────────────

export const releaseAttach: McpTool = defineTool({
    name: 'release.attach',
    description: 'Attach an entity\'s current draft to the release. Accepts EITHER a single `member` OR an `items[]` batch (F8-bulk shape). The publisher snapshots both the current draft and the pre-release live state at attach time.',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['releaseId'],
        properties: {
            releaseId: {type: 'string'},
            member: {
                type: 'object',
                required: ['entity', 'id'],
                properties: {
                    entity: {type: 'string', enum: ENTITY_ENUM},
                    id: {type: 'string'},
                },
            },
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['entity', 'id'],
                    properties: {
                        entity: {type: 'string', enum: ENTITY_ENUM},
                        id: {type: 'string'},
                    },
                },
            },
        },
    },
}, async (args, ctx) => {
    const svc = releaseService();
    const releaseId = String(args.releaseId);
    const batch: Array<{entity: string; id: string}> = Array.isArray(args.items)
        ? (args.items as any[])
        : args.member
            ? [args.member as any]
            : [];
    if (!batch.length) throw new Error('release.attach: pass `member` or `items[]`');
    const result = await runBatch(
        batch.map(b => ({id: `${b.entity}:${b.id}`, payload: b})),
        async (_combinedId, payload) => {
            const m = payload!;
            await svc.attach({
                releaseId,
                entity: m.entity as any,
                id: m.id,
                actor: ctx.actor,
            });
            return {entity: m.entity, refId: m.id};
        },
    );
    return result;
});

export const releaseDetach: McpTool = defineTool({
    name: 'release.detach',
    description: 'Remove a member from a release by (entity, id).',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['releaseId', 'entity', 'id'],
        properties: {
            releaseId: {type: 'string'},
            entity: {type: 'string', enum: ENTITY_ENUM},
            id: {type: 'string'},
        },
    },
}, async (args) => {
    return releaseService().detach(String(args.releaseId), args.entity as any, String(args.id));
});

// ─── Publish / Rollback ──────────────────────────────────────────

export const releasePublish: McpTool = defineTool({
    name: 'release.publish',
    description: 'Atomically write every member\'s frozen snapshot to its live collection. On replica-set Mongo, runs inside a single transaction; on standalone, falls back to a sequential write with compensating revert on failure. Idempotent — repeated calls with the same idempotencyKey return the first result.',
    scopes: ['write:content'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string'},
            expectedVersion: {type: 'integer', minimum: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    return releaseService().publish({
        releaseId: String(args.id),
        expectedVersion: typeof args.expectedVersion === 'number' ? args.expectedVersion : undefined,
        actor: ctx.actor,
    });
});

export const releaseRollback: McpTool = defineTool({
    name: 'release.rollback',
    description: 'Create a "Rollback of <title>" release whose members restore the pre-release snapshots, auto-publish it, and mark the original release `rolled-back`. Only valid on a release in `published` status.',
    scopes: ['write:content'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    return releaseService().rollback(String(args.id), ctx.actor);
});

export const RELEASE_TOOLS: McpTool[] = [
    releaseList,
    releaseGet,
    releasePreviewAt,
    releaseCreate,
    releaseUpdate,
    releaseDelete,
    releaseAttach,
    releaseDetach,
    releasePublish,
    releaseRollback,
];
