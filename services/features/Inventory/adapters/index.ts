import type {IAdapterConfig} from '@interfaces/IInventory';
import type {IWarehouseAdapter} from './IWarehouseAdapter';
import {MockAdapter} from './MockAdapter';
import {GenericFeedAdapter} from './GenericFeedAdapter';
import {SsComCarsAdapter} from './SsComCarsAdapter';
import {TdSynnexStreamOneAdapter} from '@services/features/Dropship/TdSynnexStreamOne';
import {TmeAdapter} from '@services/features/Dropship/Tme';

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
        case 'ss-com-cars':
            return new SsComCarsAdapter(config);
        case 'td-synnex-stream-one':
            // Scaffold step of pc-parts-dropshipping-integration.
            // Every method on this adapter throws
            // `TdSynnexNotCredentialedError` until the operator
            // acquires a TD SYNNEX partner account and drops creds
            // into env. `commerce.dropshipEnabled` gates higher-level
            // call sites; this factory entry just makes the adapter
            // constructible for `isConfigured()` introspection +
            // admin-pane display.
            return new TdSynnexStreamOneAdapter({
                baseUrl: config.baseUrl,
                clientId: config.clientId,
                clientSecret: config.clientSecret,
                resellerId: config.resellerId,
            });
        case 'tme':
            // Scaffold step of pc-parts-dropshipping-integration —
            // **recommended first-impl distributor** post the
            // 2026-05-16 EU research pivot. TME has self-service
            // developer signup (no 2-4 week B2B onboarding), free
            // public REST API + GitHub SDKs, EU-wide coverage, and
            // carries the maker / robotics / AI-edge SKUs that
            // broaden the storefront beyond PC-only. Methods throw
            // `TmeNotCredentialedError` until TME_TOKEN +
            // TME_APP_SECRET land in .env.
            return new TmeAdapter({
                baseUrl: config.baseUrl,
                token: config.token,
                appSecret: config.appSecret,
                country: config.country,
                language: config.language,
            });
        default:
            throw new Error(`createAdapter: unknown adapter kind '${(config as {kind: string}).kind}'`);
    }
}

export {MockAdapter, GenericFeedAdapter, SsComCarsAdapter};
export {TdSynnexStreamOneAdapter} from '@services/features/Dropship/TdSynnexStreamOne';
export {TmeAdapter} from '@services/features/Dropship/Tme';
export type {IWarehouseAdapter};
