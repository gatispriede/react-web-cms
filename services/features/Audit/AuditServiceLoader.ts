import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {AuditService} from './AuditService';

/**
 * Audit Loader — Class Loader L3 migration of `auditFeature`.
 *
 * Behaviour preserved 1:1 from the prior literal manifest. Note:
 * `AuditService` builds its own indexes lazily inside `ensureIndexes()`,
 * so this loader deliberately does NOT mirror them in `indexes`.
 *
 * `getErrorLog` belongs to the Observability feature (owns ErrorLogService);
 * Audit only owns the audit-log triplet.
 */
export class AuditServiceLoader extends ServiceLoader {
    readonly id = 'audit';
    readonly displayName = 'Audit log';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {audit: new AuditService(ctx.db)};
    }

    readonly schemaSDL = `extend type QueryMongo {
    getAuditLog(filter: JSON): String!
    getAuditCollections: String!
    getAuditActors: String!
}`;

    readonly authz: FeatureAuthzContribution = {
        queryRequirements: {
            getAuditLog: 'admin',
            getAuditCollections: 'admin',
            getAuditActors: 'admin',
        },
    };
}
