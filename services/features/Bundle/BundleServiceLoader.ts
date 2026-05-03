import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {BundleService} from './BundleService';

/**
 * Bundle Loader — Class Loader L3 migration of `bundleFeature`.
 * Owns `BundleService` — bulk import/export of the site as JSON.
 * Single-arg ctor, no indexes, no lifecycle.
 *
 * Bundle's import/export today runs through HTTP routes
 * (`/api/import` + `/api/export`) and the agent's MCP tool surface, NOT
 * a GraphQL mutation. The `resourceGated` entries below DECLARE the
 * intent so when the routes do flow through the guarded proxy (or a
 * GraphQL `bundleImport` / `bundleExport` mutation lands), the gate is
 * already wired. Today they are inert — the proxy never sees these
 * method names — but they document the dimension contract.
 */
export class BundleServiceLoader extends ServiceLoader {
    readonly id = 'bundle';
    readonly displayName = 'Bundle import/export';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {bundle: new BundleService(ctx.db)};
    }

    readonly authz: FeatureAuthzContribution = {
        // Q10 — bundle import/export is a site-wide power tool. Feature
        // dimension only — no per-page/locale slice; either you own the
        // whole bundle or you don't.
        resourceGated: {
            import: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Bundle'},
            }),
            export: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Bundle'},
            }),
        },
    };
}
