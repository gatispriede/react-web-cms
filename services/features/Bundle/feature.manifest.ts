import type {FeatureManifest} from '@services/infra/featureManifest';
import {BundleServiceLoader} from './BundleServiceLoader';

export const bundleFeature: FeatureManifest = new BundleServiceLoader().toManifest();
