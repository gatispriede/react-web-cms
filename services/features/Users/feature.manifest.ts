import type {FeatureManifest} from '@services/infra/featureManifest';
import {UsersServiceLoader, _resetAdminSeededForTest} from './UsersServiceLoader';

export const usersFeature: FeatureManifest = new UsersServiceLoader().toManifest();

/** Re-exported so existing imports (`@services/features/Users/feature.manifest`) keep working. */
export {_resetAdminSeededForTest};
