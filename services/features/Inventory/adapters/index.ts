import type {IAdapterConfig} from '@interfaces/IInventory';
import type {IWarehouseAdapter} from './IWarehouseAdapter';
import {MockAdapter} from './MockAdapter';
import {GenericFeedAdapter} from './GenericFeedAdapter';

/**
 * Adapter factory. Switches on the discriminated `IAdapterConfig.kind`.
 * Throws on unknown kind so a stale `SiteSettings` value (e.g. after a
 * downgrade) surfaces as a clear error in the admin UI rather than a
 * silent fallback.
 */
export function createAdapter(config: IAdapterConfig): IWarehouseAdapter {
    if (!config || typeof config !== 'object') {
        throw new Error('createAdapter: config is required');
    }
    switch (config.kind) {
        case 'mock':
            return new MockAdapter();
        case 'generic-feed':
            return new GenericFeedAdapter(config);
        default:
            throw new Error(`createAdapter: unknown adapter kind '${(config as {kind: string}).kind}'`);
    }
}

export {MockAdapter, GenericFeedAdapter};
export type {IWarehouseAdapter};
