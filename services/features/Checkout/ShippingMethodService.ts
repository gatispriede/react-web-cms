/**
 * Phase 1.B-c — checkout customization.
 *
 * `ShippingMethodService` — CRUD over the `ShippingMethods` Mongo
 * collection. Storefront reads `listActive()`; admin reads `list()` and
 * mutates via `create/update/delete/reorder`.
 *
 * Cargo-cult of `CustomerProfileService` (Phase 1.E):
 *   - Collection injected via constructor (test-friendly).
 *   - `audit` fields stamped on every write (`{editedAt, editedBy}` +
 *     optimistic `version`).
 *   - Returns `{ok, error?}` envelopes so MCP tools can pass them
 *     through verbatim.
 *
 * Seed: on first `seedDefaults()` call, if the collection is empty,
 * inserts a single "Standard delivery" flat-rate (0 EUR) method so
 * the checkout never renders an empty shipping list.
 */
import type {Collection} from 'mongodb';
import guid from '@utils/guid';
import type {IShippingMethod, ShippingMethodType} from '@interfaces/IShippingMethod';

const PROJ = {_id: 0} as const;

export interface IShippingMethodSeedHandle {
    collection: Collection;
}

let serviceRef: ShippingMethodService | null = null;

/** Boot-time setter — `CheckoutFeatureLoader.buildServices` stamps the live instance. */
export function registerShippingMethodService(svc: ShippingMethodService | null): void {
    serviceRef = svc;
}
export function getShippingMethodService(): ShippingMethodService {
    if (!serviceRef) throw new Error('ShippingMethodService not registered yet — boot order issue');
    return serviceRef;
}

export class ShippingMethodService {
    constructor(private readonly col: Collection) {}

    /** Admin-grade read of every row, sorted by `displayOrder`. */
    async list(): Promise<IShippingMethod[]> {
        const rows = await this.col.find({}, {projection: PROJ}).sort({displayOrder: 1}).toArray();
        return rows as unknown as IShippingMethod[];
    }

    /** Storefront-grade read — active rows only, sorted by `displayOrder`. */
    async listActive(): Promise<IShippingMethod[]> {
        const rows = await this.col.find({isActive: true}, {projection: PROJ}).sort({displayOrder: 1}).toArray();
        return rows as unknown as IShippingMethod[];
    }

    async getById(id: string): Promise<IShippingMethod | null> {
        const row = await this.col.findOne({id}, {projection: PROJ});
        return (row as unknown as IShippingMethod | null) ?? null;
    }

    async create(input: Omit<IShippingMethod, 'id' | 'version' | 'createdAt' | 'editedAt'>, actor?: string): Promise<{ok: boolean; id?: string; error?: string}> {
        if (!input?.name || !input?.type) return {ok: false, error: 'name + type required'};
        const id = guid();
        const now = new Date();
        const next: IShippingMethod = {
            ...input,
            id,
            isActive: input.isActive ?? true,
            displayOrder: typeof input.displayOrder === 'number' ? input.displayOrder : await this.nextDisplayOrder(),
            createdAt: now,
            createdBy: actor,
            editedAt: now,
            editedBy: actor,
            version: 1,
        };
        await this.col.insertOne(next as never);
        return {ok: true, id};
    }

    async update(id: string, patch: Partial<IShippingMethod>, actor?: string): Promise<{ok: boolean; error?: string; version?: number}> {
        const current = await this.getById(id);
        if (!current) return {ok: false, error: 'shipping method not found'};
        const $set: Record<string, unknown> = {};
        const allowed: (keyof IShippingMethod)[] = [
            'name', 'type', 'isActive', 'displayOrder', 'availableCountries',
            'flatRate', 'weightBased', 'freeThreshold', 'pickup',
        ];
        for (const k of allowed) {
            if (k in patch) $set[k as string] = patch[k];
        }
        $set.editedAt = new Date();
        if (actor) $set.editedBy = actor;
        const nextVersion = (current.version ?? 1) + 1;
        $set.version = nextVersion;
        await this.col.updateOne({id}, {$set});
        return {ok: true, version: nextVersion};
    }

    async delete(id: string): Promise<{ok: boolean; error?: string}> {
        const res = await this.col.deleteOne({id});
        if (res.deletedCount === 0) return {ok: false, error: 'shipping method not found'};
        return {ok: true};
    }

    /** Bulk reorder — passes the full ordered id list. Unknown ids are ignored. */
    async reorder(orderedIds: string[], actor?: string): Promise<{ok: boolean}> {
        const now = new Date();
        for (let i = 0; i < orderedIds.length; i++) {
            await this.col.updateOne(
                {id: orderedIds[i]},
                {$set: {displayOrder: i, editedAt: now, editedBy: actor}},
            );
        }
        return {ok: true};
    }

    /** Idempotent seeder — inserts the "Standard delivery" row when collection is empty. */
    async seedDefaults(actor?: string): Promise<{ok: boolean; seeded: boolean}> {
        const count = await this.col.countDocuments({});
        if (count > 0) return {ok: true, seeded: false};
        await this.create({
            name: 'Standard delivery',
            type: 'flat-rate' as ShippingMethodType,
            isActive: true,
            displayOrder: 0,
            flatRate: {amount: 0, currency: 'EUR'},
        }, actor);
        return {ok: true, seeded: true};
    }

    private async nextDisplayOrder(): Promise<number> {
        const last = await this.col.find({}, {projection: PROJ}).sort({displayOrder: -1}).limit(1).toArray();
        const max = (last[0] as unknown as IShippingMethod | undefined)?.displayOrder;
        return typeof max === 'number' ? max + 1 : 0;
    }
}
