import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureContext, FeatureIndexSpec} from '@services/infra/featureManifest';
import {ErrorLogService} from './ErrorLogService';

const RETENTION_SECONDS = 60 * 60 * 24 * 30;

/**
 * Observability Loader — Class Loader L3 migration of `observabilityFeature`.
 * Owns `ErrorLogService`. Feature id is `observability` (not `errorLog`)
 * to leave room for future logging/metrics services under one umbrella;
 * service key stays `errorLog` to match the legacy
 * `mongoConn.errorLogService` getter.
 */
export class ObservabilityServiceLoader extends ServiceLoader {
    readonly id = 'observability';
    readonly displayName = 'Observability';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {errorLog: new ErrorLogService(ctx.db)};
    }

    readonly indexes: readonly FeatureIndexSpec[] = [
        {collection: 'ErrorLog', spec: {ts: 1}, options: {expireAfterSeconds: RETENTION_SECONDS}},
        {collection: 'ErrorLog', spec: {source: 1, ts: -1}},
        {collection: 'ErrorLog', spec: {level: 1, ts: -1}},
    ];

    readonly schemaSDL = `extend type QueryMongo {
    """Recent rows from the structured ErrorLog collection. Filters mirror MCP's audit.errors."""
    getErrorLog(source: String, level: String, scope: String, sinceISO: String, limit: Int): String!
}`;
}
