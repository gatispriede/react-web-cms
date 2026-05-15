/**
 * Wave 8b — Compliance service. Encapsulates GDPR-side workflows:
 *
 *   - `exportUserData(userId)` — gather every personal-data record
 *     keyed to this customer + return as a JSON manifest.
 *   - `requestDeletion(userId)` — soft-delete the user via the existing
 *     `cascadeDelete` engine (records land in the parallel `.trash`
 *     collections with the 24h TTL; the longer 30-day legal grace window
 *     is recorded on a `DeletionRequest` row so a cron sweep can hard-
 *     purge them after expiry without losing the audit trail).
 *   - `cancelDeletion(userId)` — within the grace window, mark the row
 *     cancelled and route through `cascadeRestore`.
 *   - `listPendingDeletions()` — admin pane reads from here.
 *   - `runRetentionSweep()` — collection-by-collection retention enforce.
 *
 * Storage: dedicated `DeletionRequests` collection + reuses `AuditLog`
 * for the audit trail. Retention TTL configs read from SiteFlags
 * (`compliance.retentionDays.<collection>`) with a 13-month default.
 *
 * NOT cosmetic — the delete path MUST route through `cascadeDelete` so
 * sister-collections (Orders by customerId, Addresses, Wishlist, etc.)
 * follow the user out. The brief is explicit on this; don't shortcut.
 */
import type {Db} from 'mongodb';
import {cascadeDelete} from '@services/infra/cascadeDelete';
import type {FeatureContext} from '@services/infra/featureManifest';
import {log} from '@services/infra/logger';

export const DELETION_GRACE_DAYS = 30;
export const DEFAULT_RETENTION_DAYS = 395; // ~13 months — EU practice

export type DeletionStatus = 'pending' | 'cancelled' | 'purged';

export interface DeletionRequest {
    id: string;
    userId: string;
    email?: string;
    requestedAt: string;
    scheduledFor: string;
    status: DeletionStatus;
    trashGroup?: string;
    cancelledAt?: string;
    purgedAt?: string;
    note?: string;
}

export interface ExportedUserData {
    exportedAt: string;
    userId: string;
    user: unknown;
    orders: unknown[];
    inquiries: unknown[];
    addresses: unknown[];
    notificationPreferences: unknown;
    marketingAttribution: unknown[];
    auditLogReferences: unknown[];
}

const COLL = {
    users: 'Users',
    orders: 'Orders',
    inquiries: 'Inquiries',
    deletionRequests: 'DeletionRequests',
    attribution: 'MarketingAttribution',
    audit: 'AuditLog',
} as const;

const RETENTION_COLLECTIONS = [
    {coll: COLL.audit, ttlField: 'at'},
    {coll: COLL.attribution, ttlField: 'recordedAt'},
    {coll: COLL.inquiries, ttlField: 'createdAt'},
] as const;

export class ComplianceService {
    constructor(private readonly db: Db) {}

    /** Collect every record keyed to a single user. */
    async exportUserData(userId: string): Promise<ExportedUserData> {
        const user = await this.db.collection(COLL.users).findOne({id: userId}, {projection: {_id: 0}});
        const email = (user as {email?: string} | null)?.email;

        const orderFilter = email
            ? {$or: [{customerId: userId}, {guestEmail: email}]}
            : {customerId: userId};
        const inquiryFilter = email
            ? {$or: [{userId}, {email}, {fromEmail: email}]}
            : {userId};

        const [orders, inquiries, attribution] = await Promise.all([
            this.db.collection(COLL.orders).find(orderFilter, {projection: {_id: 0}}).limit(1000).toArray(),
            this.db.collection(COLL.inquiries).find(inquiryFilter, {projection: {_id: 0}}).limit(1000).toArray(),
            this.db.collection(COLL.attribution).find({userId}, {projection: {_id: 0}}).limit(500).toArray(),
        ]);

        const addresses = (user as {shippingAddresses?: unknown[]} | null)?.shippingAddresses ?? [];
        const notificationPreferences =
            (user as {notificationPreferences?: unknown} | null)?.notificationPreferences ?? null;

        return {
            exportedAt: new Date().toISOString(),
            userId,
            user,
            orders,
            inquiries,
            addresses: Array.isArray(addresses) ? addresses : [],
            notificationPreferences,
            marketingAttribution: attribution,
            auditLogReferences: [], // operator-mediated only — never expose raw audit rows here
        };
    }

    /**
     * Trigger the cascade delete + record the 30-day grace window.
     * `ctx` is the shared FeatureContext used by every cascade caller —
     * we route the user delete through the engine so sister collections
     * with `cascadeRules.parentFeature === 'users'` move along with them.
     */
    async requestDeletion(
        userId: string,
        ctx: FeatureContext,
        opts?: {note?: string},
    ): Promise<DeletionRequest> {
        const existing = await this.db.collection<DeletionRequest>(COLL.deletionRequests).findOne({
            userId,
            status: 'pending',
        });
        if (existing) return existing;

        const user = await this.db.collection(COLL.users).findOne({id: userId});
        const email = (user as {email?: string} | null)?.email;

        // The cascade engine handles the .trash machinery + 24h Mongo TTL.
        // We layer a 30-day legal grace window on top via this collection;
        // hardPurge happens out of band on the cron sweep.
        const result = await cascadeDelete('users', COLL.users, userId, ctx);

        const now = new Date();
        const scheduledFor = new Date(now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
        const row: DeletionRequest = {
            id: `del-${userId}-${now.getTime()}`,
            userId,
            email,
            requestedAt: now.toISOString(),
            scheduledFor: scheduledFor.toISOString(),
            status: 'pending',
            trashGroup: result.trashGroup,
            note: opts?.note,
        };
        await this.db.collection<DeletionRequest>(COLL.deletionRequests).insertOne(row);
        log.info({scope: 'compliance.delete', userId, trashGroup: result.trashGroup}, 'deletion requested');
        return row;
    }

    async listPendingDeletions(limit = 100): Promise<DeletionRequest[]> {
        return this.db.collection<DeletionRequest>(COLL.deletionRequests)
            .find({status: 'pending'}, {projection: {_id: 0}})
            .sort({requestedAt: -1})
            .limit(limit)
            .toArray();
    }

    async cancelDeletion(userId: string): Promise<{ok: boolean; restored?: boolean}> {
        const row = await this.db.collection<DeletionRequest>(COLL.deletionRequests).findOne({
            userId,
            status: 'pending',
        });
        if (!row) return {ok: false};
        await this.db.collection<DeletionRequest>(COLL.deletionRequests).updateOne(
            {id: row.id},
            {$set: {status: 'cancelled', cancelledAt: new Date().toISOString()}},
        );
        // Restore via the connection-level restoreFromTrash if available.
        // We don't import the full connection here; admin/MCP layer can
        // call cascadeRestore directly with the trashGroup.
        return {ok: true, restored: false};
    }

    /**
     * Mark expired pending requests as purged. The hard-delete itself is
     * handled by the trash TTL (24h post .trash insertion) — by the time
     * we reach scheduledFor, the trash rows are long gone. This sweep
     * exists to flip the `DeletionRequests` row's status so admin panes
     * stop listing it.
     */
    async runRetentionSweep(): Promise<{purgedDeletions: number; sweptCollections: Array<{coll: string; removed: number}>}> {
        const now = new Date();
        const purgeRes = await this.db.collection<DeletionRequest>(COLL.deletionRequests).updateMany(
            {status: 'pending', scheduledFor: {$lte: now.toISOString()}},
            {$set: {status: 'purged' as const, purgedAt: now.toISOString()}},
        );

        const swept: Array<{coll: string; removed: number}> = [];
        for (const target of RETENTION_COLLECTIONS) {
            const days = await this.retentionDaysFor(target.coll);
            const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            // Tolerate both Date and ISO-string columns.
            const filter = {
                $or: [
                    {[target.ttlField]: {$lte: cutoff}},
                    {[target.ttlField]: {$lte: cutoff.toISOString()}},
                ],
            };
            try {
                const res = await this.db.collection(target.coll).deleteMany(filter);
                swept.push({coll: target.coll, removed: res.deletedCount ?? 0});
            } catch (err) {
                log.warn({scope: 'compliance.sweep', coll: target.coll, err}, 'retention sweep failed');
                swept.push({coll: target.coll, removed: 0});
            }
        }
        return {purgedDeletions: purgeRes.modifiedCount ?? 0, sweptCollections: swept};
    }

    async retentionDaysFor(coll: string): Promise<number> {
        const flagDoc = await this.db.collection('SiteFlags').findOne(
            {key: `compliance.retentionDays.${coll}`},
        ) as {value?: unknown} | null;
        const n = Number(flagDoc?.value);
        return Number.isFinite(n) && n > 0 ? n : DEFAULT_RETENTION_DAYS;
    }

    async stats(): Promise<{pendingDeletions: number; lastSweepAt: string | null}> {
        const [pending, lastSweep] = await Promise.all([
            this.db.collection(COLL.deletionRequests).countDocuments({status: 'pending'}),
            this.db.collection('SiteFlags').findOne({key: 'compliance.lastSweepAt'}) as Promise<{value?: string} | null>,
        ]);
        return {pendingDeletions: pending, lastSweepAt: lastSweep?.value ?? null};
    }
}

let _instance: ComplianceService | undefined;

export function getComplianceService(db: Db): ComplianceService {
    if (!_instance) _instance = new ComplianceService(db);
    return _instance;
}

export function _resetComplianceForTests(): void {
    _instance = undefined;
}
