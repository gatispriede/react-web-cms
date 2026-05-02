import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureContext} from '@services/infra/featureManifest';
import {BundleService} from './BundleService';

/**
 * Bundle Loader — Class Loader L3 migration of `bundleFeature`.
 * Owns `BundleService` — bulk import/export of the site as JSON.
 * Single-arg ctor, no indexes, no lifecycle, no SDL/authz (Option A).
 */
export class BundleServiceLoader extends ServiceLoader {
    readonly id = 'bundle';
    readonly displayName = 'Bundle import/export';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {bundle: new BundleService(ctx.db)};
    }
}
