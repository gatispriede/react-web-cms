/**
 * ReleaseService — first-class Content Releases.
 *
 * A release groups N draft entities (page / post / product / theme /
 * navigation / footer / seo) and publishes them atomically. Operators
 * preview the site at a release's perspective before flipping it live;
 * rollback re-attaches the pre-release snapshots into a new release
 * and auto-publishes that.
 *
 * Atomicity strategy:
 *
 *   - When the Mongo client reports replica-set / transaction support,
 *     the publish path runs inside a single `withTransaction` — every
 *     member writes via the session or none do.
 *   - Standalone Mongo (the dev mongodb-memory-server default) doesn't
 *     support transactions; the publish path falls back to a sequential
 *     write loop that REVERTS already-written members on the first
 *     failure (compensating saga via the captured pre-release
 *     snapshots).
 *
 * Concurrency:
 *
 *   - Every mutation increments `version`; clients pass
 *     `expectedVersion` to detect stale-read overwrites.
 *   - `publish` flips status to `publishing` under an OCC guard, so a
 *     concurrent publish call on the same release short-circuits with
 *     "release is busy".
 *
 * What's cut from v1 (vs the spec):
 *
 *   - Per-feature validation guards (`canPublish`) — publish writes
 *     whatever was captured at attach time without re-validating.
 *   - Scheduled publish (no `scheduledFor` worker yet — the field is
 *     stored but `publishRelease` does not honour future timestamps).
 *   - Approval / review workflows.
 *   - The dedicated `ReleaseSnapshots` collection — snapshots live
 *     inline on the release document for now.
 *
 * Each member's `snapshot` is captured at attach time. Editing the
 * source entity after attach does NOT change what publishes — operators
 * re-attach to refresh.
 */

import type {Collection, Db, MongoClient} from 'mongodb';
import guid from '@utils/guid';
import {log} from '@services/infra/logger';
import type {
    IRelease,
    IReleaseSummary,
    ReleaseEntityKind,
    ReleaseMember,
    ReleaseStatus,
} from '@interfaces/IRelease';
import {RELEASE_ENTITY_KINDS, RELEASE_STATUSES, toReleaseSummary} from '@interfaces/IRelease';
import {buildPublishers, type EntityPublisher} from './publishers';

const COLLECTION = 'Releases';

export interface CreateReleaseInput {
    title: string;
    description?: string;
    actor?: string;
}

export interface AttachInput {
    releaseId: string;
    entity: ReleaseEntityKind;
    id: string;
    /** Optional override — if omitted, the publisher reads the current draft. */
    draft?: Record<string, unknown>;
    actor?: string;
}

export interface PublishInput {
    releaseId: string;
    expectedVersion?: number;
    actor?: string;
}

export class ReleaseService {
    private readonly publishers: Record<ReleaseEntityKind, EntityPublisher>;
    constructor(private readonly db: Db, private readonly client?: MongoClient) {
        this.publishers = buildPublishers(db);
    }

    private col(): Collection<IRelease> {
        return this.db.collection<IRelease>(COLLECTION);
    }

    // ─── CRUD ───────────────────────────────────────────────────────

    async create(input: CreateReleaseInput): Promise<IRelease> {
        const title = (input.title ?? '').trim();
        if (!title) throw new Error('release.title is required');
        const now = new Date().toISOString();
        const doc: IRelease = {
            id: guid(),
            title,
            description: input.description?.trim() || undefined,
            status: 'draft',
            members: [],
            createdAt: now,
            updatedAt: now,
            createdBy: input.actor,
            version: 1,
        };
        await this.col().insertOne(doc as any);
        return doc;
    }

    async list(opts?: {status?: ReleaseStatus}): Promise<IReleaseSummary[]> {
        const filter: Record<string, unknown> = {};
        if (opts?.status) {
            if (!RELEASE_STATUSES.includes(opts.status)) {
                throw new Error(`unknown release status: ${opts.status}`);
            }
            filter.status = opts.status;
        }
        const docs = await this.col().find(filter as any).sort({createdAt: -1}).toArray();
        return docs.map(d => toReleaseSummary(d));
    }

    async get(id: string): Promise<IRelease | null> {
        const doc = await this.col().findOne({id});
        if (!doc) return null;
        const clone = {...(doc as Record<string, unknown>)};
        delete clone._id;
        return clone as unknown as IRelease;
    }

    async update(
        id: string,
        patch: Partial<Pick<IRelease, 'title' | 'description' | 'scheduledFor'>>,
        expectedVersion?: number,
    ): Promise<IRelease> {
        const current = await this.requireMutable(id, expectedVersion);
        const next: Partial<IRelease> = {
            ...patch,
            updatedAt: new Date().toISOString(),
            version: current.version + 1,
        };
        await this.col().updateOne(
            {id, version: current.version},
            {$set: next as any},
        );
        return (await this.get(id))!;
    }

    async delete(id: string): Promise<void> {
        const r = await this.get(id);
        if (!r) return;
        if (r.status === 'publishing') {
            throw new Error('cannot delete a release while it is publishing');
        }
        await this.col().deleteOne({id});
    }

    // ─── Members ────────────────────────────────────────────────────

    async attach(input: AttachInput): Promise<IRelease> {
        if (!RELEASE_ENTITY_KINDS.includes(input.entity)) {
            throw new Error(`unknown release entity kind: ${input.entity}`);
        }
        const current = await this.requireMutable(input.releaseId);
        const pub = this.publishers[input.entity];
        const live = await pub.snapshot(input.id);
        const draft = input.draft ?? live;
        if (!draft) {
            throw new Error(`entity ${input.entity}:${input.id} has no draft to attach`);
        }
        const now = new Date().toISOString();
        const member: ReleaseMember = {
            entity: input.entity,
            id: input.id,
            label: pub.label(draft),
            snapshot: draft,
            preReleaseSnapshot: live,
            attachedAt: now,
            attachedBy: input.actor,
        };
        // Replace any existing membership for the same (entity,id) pair.
        const filteredMembers = current.members.filter(
            m => !(m.entity === input.entity && m.id === input.id),
        );
        filteredMembers.push(member);
        await this.col().updateOne(
            {id: current.id, version: current.version},
            {
                $set: {
                    members: filteredMembers as any,
                    updatedAt: now,
                    version: current.version + 1,
                },
            },
        );
        return (await this.get(current.id))!;
    }

    async detach(releaseId: string, entity: ReleaseEntityKind, id: string): Promise<IRelease> {
        const current = await this.requireMutable(releaseId);
        const members = current.members.filter(m => !(m.entity === entity && m.id === id));
        await this.col().updateOne(
            {id: current.id, version: current.version},
            {
                $set: {
                    members: members as any,
                    updatedAt: new Date().toISOString(),
                    version: current.version + 1,
                },
            },
        );
        return (await this.get(current.id))!;
    }

    // ─── Preview "perspective" ──────────────────────────────────────

    /**
     * Compose "what the site looks like if this release publishes right
     * now." Currently returns the release's member snapshots indexed by
     * entity — the SSR perspective wiring (`?previewRelease=<id>` query
     * param) lives in a follow-up. Operators preview by inspecting the
     * member list; full iframe preview is cut from v1.
     */
    async previewAt(releaseId: string): Promise<{
        releaseId: string;
        members: ReleaseMember[];
    }> {
        const r = await this.get(releaseId);
        if (!r) throw new Error(`release not found: ${releaseId}`);
        return {releaseId: r.id, members: r.members};
    }

    // ─── Publish ────────────────────────────────────────────────────

    async publish(input: PublishInput): Promise<IRelease> {
        const claim = await this.claimPublishing(input.releaseId, input.expectedVersion);
        try {
            await this.writeMembers(claim);
            const now = new Date().toISOString();
            await this.col().updateOne(
                {id: claim.id},
                {
                    $set: {
                        status: 'published' as ReleaseStatus,
                        publishedAt: now,
                        publishedBy: input.actor,
                        updatedAt: now,
                        version: claim.version + 1,
                    },
                    $unset: {lastError: ''},
                },
            );
        } catch (err) {
            const message = String((err as Error)?.message ?? err);
            log.warn({scope: 'release.publish', release: claim.id, err}, 'publish failed');
            await this.col().updateOne(
                {id: claim.id},
                {
                    $set: {
                        status: 'failed' as ReleaseStatus,
                        lastError: message,
                        updatedAt: new Date().toISOString(),
                        version: claim.version + 1,
                    },
                },
            );
            throw new Error(`release publish failed: ${message}`);
        }
        return (await this.get(claim.id))!;
    }

    // ─── Rollback ───────────────────────────────────────────────────

    async rollback(releaseId: string, actor?: string): Promise<IRelease> {
        const original = await this.get(releaseId);
        if (!original) throw new Error(`release not found: ${releaseId}`);
        if (original.status !== 'published') {
            throw new Error(`cannot rollback from status ${original.status}`);
        }
        const now = new Date().toISOString();
        const rollback: IRelease = {
            id: guid(),
            title: `Rollback of ${original.title}`,
            description: `Rollback of release ${original.id}`,
            status: 'draft',
            members: original.members.map(m => ({
                entity: m.entity,
                id: m.id,
                label: m.label,
                snapshot: (m.preReleaseSnapshot ?? null) as Record<string, unknown>,
                preReleaseSnapshot: m.snapshot,
                attachedAt: now,
                attachedBy: actor,
            })),
            rollbackOf: original.id,
            createdAt: now,
            updatedAt: now,
            createdBy: actor,
            version: 1,
        };
        await this.col().insertOne(rollback as any);
        // Auto-publish the rollback — rollbacks are typically urgent.
        const published = await this.publish({releaseId: rollback.id, actor});
        await this.col().updateOne(
            {id: original.id},
            {
                $set: {
                    status: 'rolled-back' as ReleaseStatus,
                    updatedAt: new Date().toISOString(),
                    version: original.version + 1,
                },
            },
        );
        return published;
    }

    // ─── Helpers ────────────────────────────────────────────────────

    private async requireMutable(id: string, expectedVersion?: number): Promise<IRelease> {
        const r = await this.get(id);
        if (!r) throw new Error(`release not found: ${id}`);
        if (expectedVersion !== undefined && r.version !== expectedVersion) {
            throw new Error(`release version conflict (have ${r.version}, expected ${expectedVersion})`);
        }
        if (r.status !== 'draft' && r.status !== 'failed') {
            throw new Error(`release ${id} is ${r.status} — only draft / failed releases are mutable`);
        }
        return r;
    }

    /** Atomically flip status → `publishing`; rejects concurrent claims. */
    private async claimPublishing(id: string, expectedVersion?: number): Promise<IRelease> {
        const r = await this.get(id);
        if (!r) throw new Error(`release not found: ${id}`);
        if (expectedVersion !== undefined && r.version !== expectedVersion) {
            throw new Error(`release version conflict (have ${r.version}, expected ${expectedVersion})`);
        }
        if (r.status !== 'draft' && r.status !== 'failed') {
            throw new Error(`cannot publish from status ${r.status}`);
        }
        if (!r.members.length) {
            throw new Error('cannot publish an empty release');
        }
        const res = await this.col().updateOne(
            {id, version: r.version, status: {$in: ['draft', 'failed']} as any},
            {
                $set: {
                    status: 'publishing' as ReleaseStatus,
                    updatedAt: new Date().toISOString(),
                    version: r.version + 1,
                },
            },
        );
        if (res.matchedCount !== 1) {
            throw new Error(`release ${id} is busy — concurrent publish detected`);
        }
        return {...r, version: r.version + 1, status: 'publishing'};
    }

    /** Write every member's snapshot to its live collection. Atomic when
     *  transactions are available; sequential-with-compensation otherwise. */
    private async writeMembers(release: IRelease): Promise<void> {
        if (this.client && supportsTransactions(this.client)) {
            const session = this.client.startSession();
            try {
                await session.withTransaction(async () => {
                    for (const m of release.members) {
                        const pub = this.publishers[m.entity];
                        await pub.publish(m.id, m.snapshot, session);
                    }
                });
                return;
            } finally {
                await session.endSession();
            }
        }
        // Compensating-saga fallback for standalone Mongo (dev / tests).
        const applied: ReleaseMember[] = [];
        try {
            for (const m of release.members) {
                const pub = this.publishers[m.entity];
                await pub.publish(m.id, m.snapshot);
                applied.push(m);
            }
        } catch (err) {
            // Revert in reverse order so the latest write rolls back first.
            for (const m of applied.reverse()) {
                try {
                    const pub = this.publishers[m.entity];
                    await pub.publish(m.id, m.preReleaseSnapshot);
                } catch (revertErr) {
                    log.error(
                        {scope: 'release.publish.compensate', release: release.id, member: m.id, err: revertErr},
                        'compensating write failed — manual repair required',
                    );
                }
            }
            throw err;
        }
    }
}

/**
 * Best-effort transaction-support detection. Standalone Mongo throws
 * `Transaction numbers are only allowed on a replica set member`, so
 * we read the topology description; replica-set + sharded topologies
 * are the supported ones.
 */
function supportsTransactions(client: MongoClient): boolean {
    try {
        const desc: any = (client as any).topology?.description;
        const type = desc?.type ?? desc?.topologyType;
        return type === 'ReplicaSetWithPrimary' || type === 'Sharded' || type === 'LoadBalanced';
    } catch {
        return false;
    }
}
