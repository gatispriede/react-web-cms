import type {FeatureManifest} from '@services/infra/featureManifest';
import {ObservabilityServiceLoader} from './ObservabilityServiceLoader';

export const observabilityFeature: FeatureManifest = new ObservabilityServiceLoader().toManifest();
