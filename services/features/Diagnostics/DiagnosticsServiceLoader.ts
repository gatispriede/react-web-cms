import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {DiagnosticsService} from './DiagnosticsService';

/**
 * F5 — Diagnostics Loader. Owns the read-only `getDiagnostics` query
 * surfaced at `/admin/system/info`. Admin-only; no mutations.
 *
 * `coreInfrastructure: true` because the operator-facing diag pane is
 * a deploy-verification surface — disabling it would defeat its purpose.
 */
export class DiagnosticsServiceLoader extends ServiceLoader {
    readonly id = 'diagnostics';
    readonly displayName = 'Diagnostics';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {diagnostics: new DiagnosticsService(ctx.db, ctx.redis)};
    }

    readonly schemaSDL = `extend type QueryMongo {
    """Operator-facing runtime snapshot — build identity, feature manifest summary, storage health, trash + idempotency counts, authorization scope counts. Admin-only."""
    getDiagnostics: String!
}`;

    readonly authz: FeatureAuthzContribution = {
        queryRequirements: {
            getDiagnostics: 'admin',
        },
    };
}
