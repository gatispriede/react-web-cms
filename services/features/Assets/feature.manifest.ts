import type {FeatureManifest} from '@services/infra/featureManifest';
import {AssetsServiceLoader} from './AssetsServiceLoader';

export const assetsFeature: FeatureManifest = new AssetsServiceLoader().toManifest();
