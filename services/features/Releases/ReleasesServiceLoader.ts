import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureContext, FeatureIndexSpec} from '@services/infra/featureManifest';
import {ReleaseService} from './ReleaseService';

/**
 * Releases Loader — first-class Content Releases (admin-content-releases.md).
 *
 * Owns `ReleaseService` — groups N draft entities into an atomic publish
 * unit. Lives under the existing `release` admin area alongside Bundle
 * + Trash + Audit. The MongoClient handle is plucked from the same
 * connection facade so transactional publishes use the live session.
 */
export class ReleasesServiceLoader extends ServiceLoader {
    readonly id = 'releases';
    readonly displayName = 'Content Releases';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        // The shared MongoClient lives on the connection facade; the
        // ServiceLoader contract only hands us `ctx.db`. Reach into the
        // db's underlying client when available so transactional
        // publishes can start a session. Standalone Mongo (dev /
        // mongodb-memory-server) lacks transaction support — the service
        // detects that and falls back to a compensating saga.
        const client = (ctx.db as any).s?.client ?? (ctx.db as any).client;
        return {releases: new ReleaseService(ctx.db, client)};
    }

    readonly indexes: readonly FeatureIndexSpec[] = [
        {collection: 'Releases', spec: {id: 1}, options: {unique: true, name: 'releases_id_unique'}},
        {collection: 'Releases', spec: {status: 1, createdAt: -1}, options: {name: 'releases_status_createdAt'}},
    ];
}
