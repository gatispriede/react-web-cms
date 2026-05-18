import type {FeatureManifest} from '@services/infra/featureManifest';
import {AuthServiceLoader} from './AuthServiceLoader';

/** Admin-auth + `auth.*` site-flag namespace. Customer-auth lives in
 *  `customerAuthFeature` (separate). */
export const authFeature: FeatureManifest = new AuthServiceLoader().toManifest();
