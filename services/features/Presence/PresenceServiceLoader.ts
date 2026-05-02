import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureContext, FeatureIndexSpec} from '@services/infra/featureManifest';
import {PresenceService} from './PresenceService';

const TTL_SECONDS = 90;

/**
 * Presence Loader — Class Loader L3 migration of `presenceFeature`.
 * Owns `PresenceService` (short-lived "who's editing what" markers).
 */
export class PresenceServiceLoader extends ServiceLoader {
    readonly id = 'presence';
    readonly displayName = 'Presence';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {presence: new PresenceService(ctx.db)};
    }

    readonly indexes: readonly FeatureIndexSpec[] = [
        {collection: 'Presence', spec: {email: 1, docId: 1}, options: {unique: true}},
        {collection: 'Presence', spec: {at: 1}, options: {expireAfterSeconds: TTL_SECONDS}},
    ];
}
