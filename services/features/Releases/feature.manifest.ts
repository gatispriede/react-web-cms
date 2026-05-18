import type {FeatureManifest} from '@services/infra/featureManifest';
import {ReleasesServiceLoader} from './ReleasesServiceLoader';

export const releasesFeature: FeatureManifest = new ReleasesServiceLoader().toManifest();
