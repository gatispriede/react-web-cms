import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {OnboardingService, OnboardingBootstrapInput} from './OnboardingService';
import {log} from '@services/infra/logger';

/**
 * Onboarding Loader — Q7 first-run wizard backend.
 *
 * Two GraphQL ops:
 *   - `isFreshInstall` (query, anon-allowed) — the wizard route + the
 *     AdminApp boot guard both read this.
 *   - `onboardingBootstrap` (mutation, anon-allowed because the very
 *     first admin can't have a session yet). The service re-checks
 *     `isFreshInstall` internally before mutating, so opening this
 *     anonymously isn't a privilege escalation: once an admin exists,
 *     the call throws.
 *
 * Resolver bypass: both ops bypass `guardMethods` and resolve directly
 * to the OnboardingService. There's no role to check (no admin yet),
 * and the service-side fresh-install gate is the actual safety check.
 * Mirrors the Cart-loader pattern (owner-based bypass).
 */

function svc(): OnboardingService {
    const conn = getMongoConnection() as any;
    const s = conn.featureServices?.onboarding as OnboardingService | undefined;
    if (!s) throw new Error('OnboardingService not available');
    return s;
}

export class OnboardingServiceLoader extends ServiceLoader {
    readonly id = 'onboarding';
    readonly displayName = 'Onboarding';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        const hashSaltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
        return {onboarding: new OnboardingService(ctx.db, hashSaltRounds)};
    }

    readonly schemaSDL = `extend type QueryMongo {
    isFreshInstall: Boolean!
}
extend type MutationMongo {
    onboardingBootstrap(siteName: String!, locale: String!, adminEmail: String!, adminPassword: String!, themeKey: String): String!
}`;

    readonly resolvers = {
        QueryMongo: {
            isFreshInstall: async () => {
                try { return await svc().isFreshInstall(); }
                catch (err) {
                    log.error({scope: 'onboarding.isFreshInstall.resolver', err}, 'query failed');
                    return false;
                }
            },
        },
        MutationMongo: {
            onboardingBootstrap: async (_parent: unknown, args: OnboardingBootstrapInput) => {
                try {
                    const result = await svc().bootstrap(args);
                    return JSON.stringify({onboardingBootstrap: result});
                } catch (err) {
                    return JSON.stringify({error: String((err as Error).message ?? err)});
                }
            },
        },
    };

    // Empty — both ops bypass guardMethods entirely (see class header).
    readonly authz: FeatureAuthzContribution = {};
}
