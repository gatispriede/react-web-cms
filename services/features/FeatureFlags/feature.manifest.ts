import type {FeatureManifest} from '@services/infra/featureManifest';
import {FeatureFlagsServiceLoader} from './FeatureFlagsServiceLoader';

export const featureFlagsFeature: FeatureManifest = new FeatureFlagsServiceLoader().toManifest();

export default featureFlagsFeature;
