import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureContext} from '@services/infra/featureManifest';
import {AdminAuthService} from './AdminAuthService';

// Side-effect import — registers the `auth.*` site-flag namespace via
// `defineFlag()` at module load. Has to happen before any consumer
// reads `siteFlags.auth.clientLoginEnabled`.
import './authFlags';

/**
 * Auth feature loader (Phase 1.A — auth-split-client-admin).
 *
 * Owns admin-side identity helpers (session invalidation, role
 * lookups). Customer-side helpers stay in `customerAuthFeature`.
 *
 * The loader is also the boot anchor for the `auth.*` site-flag
 * registrations — re-exported via the side-effect import above so
 * features that read `siteFlags.auth.clientLoginEnabled` (middleware,
 * storefront components) can trust the namespace exists.
 *
 * Default ON — admin auth is core infrastructure and never gates
 * itself off. The flag-driven gating is per-storefront-surface, not
 * per-feature.
 */
export class AuthServiceLoader extends ServiceLoader {
    readonly id = 'auth';
    readonly displayName = 'Admin authentication';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {
            adminAuth: new AdminAuthService(ctx.db.collection('Users')),
        };
    }
}
