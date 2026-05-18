import type {FeatureManifest} from '@services/infra/featureManifest';
import {ProductTemplatesServiceLoader} from './ProductTemplatesServiceLoader';

export const productTemplatesFeature: FeatureManifest = new ProductTemplatesServiceLoader().toManifest();
