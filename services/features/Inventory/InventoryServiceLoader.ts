import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext, FeatureIndexSpec} from '@services/infra/featureManifest';
import {InventoryService, type IRevalidator} from './InventoryService';
import type {ProductService} from '@services/features/Products/ProductService';
import type {IWarehouseAdapter} from './adapters/IWarehouseAdapter';
import {log} from '@services/infra/logger';

/**
 * Inventory Loader — Class Loader L3 migration of `inventoryFeature`.
 *
 * # Adapter cache decision: option (b) — cache stays on MongoDBConnection
 *
 * Mirrors Cart's pattern. The factory pulls the adapter resolver from
 * `getMongoConnection()` lazily (at runtime, not at boot — that would
 * re-enter the still-running connection constructor and stack-overflow).
 * The cache + invalidation stays in one place; once it moves onto its own
 * Loader the dynamic require goes away.
 *
 * `requires: ['products']` — InventoryService takes ProductService in its
 * ctor; topological sort boots Products first.
 */

/** Best-effort revalidator — same shape as the closure previously built
 *  inline in `MongoDBConnection.setupClient`. */
function buildRevalidator(): IRevalidator {
    return {
        triggerRevalidate: () => {
            try {
                const host = process.env.REVALIDATE_HOST || process.env.NEXT_PUBLIC_SITE_URL;
                if (!host) return;
                void fetch(`${host.replace(/\/$/, '')}/api/revalidate`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({scope: 'all'}),
                }).catch((err) => log.warn({scope: 'inventory.revalidate', err}, 'inventory revalidate failed'));
            } catch (err) {
                log.warn({scope: 'inventory.revalidate', err}, 'inventory revalidate failed');
            }
        },
    };
}

interface MongoConnAdapterHost {
    resolveInventoryAdapter?: () => IWarehouseAdapter;
}

export class InventoryServiceLoader extends ServiceLoader {
    readonly id = 'inventory';
    readonly displayName = 'Inventory';
    readonly requires = ['products'] as const;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        const products = ctx.services.products as ProductService | undefined;
        if (!products) {
            throw new Error('InventoryServiceLoader: ProductService missing from ctx.services.products');
        }
        // Lazy lookup — called per-request, not at boot.
        const getAdapter = (): IWarehouseAdapter => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const {getMongoConnection} = require('@services/infra/mongoDBConnection');
            const conn = getMongoConnection() as MongoConnAdapterHost;
            const fn = conn.resolveInventoryAdapter;
            if (typeof fn !== 'function') {
                throw new Error('InventoryServiceLoader: MongoDBConnection.resolveInventoryAdapter is unavailable');
            }
            return fn.call(conn);
        };
        return {
            inventory: new InventoryService(ctx.db, products, getAdapter, buildRevalidator()),
        };
    }

    readonly indexes: readonly FeatureIndexSpec[] = [
        {collection: 'InventoryRuns', spec: {status: 1, updatedAt: -1}},
        {collection: 'InventoryRuns', spec: {startedAt: -1}},
        {collection: 'InventoryRuns', spec: {id: 1}, options: {unique: true}},
        {collection: 'InventoryDeadLetters', spec: {externalId: 1}, options: {unique: true}},
    ];

    readonly schemaSDL = `extend type QueryMongo {
    inventoryStatus: String!
    inventoryReadDeadLetters(limit: Int): String!
}
extend type MutationMongo {
    inventorySyncAll: String!
    inventorySyncDelta: String!
    inventorySaveAdapterConfig(config: JSON!): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        queryRequirements: {
            inventoryStatus: 'admin',
            inventoryReadDeadLetters: 'admin',
        },
        mutationRequirements: {
            inventorySyncAll: 'admin',
            inventorySyncDelta: 'admin',
            inventorySaveAdapterConfig: 'admin',
        },
        sessionInjected: [
            'inventorySyncAll',
            'inventorySyncDelta',
            'inventorySaveAdapterConfig',
        ],
    };
}
