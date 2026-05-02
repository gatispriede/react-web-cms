import type {FeatureManifest} from '@services/infra/featureManifest';
import {SeoServiceLoader} from './SeoServiceLoader';

export const seoFeature: FeatureManifest = new SeoServiceLoader().toManifest();
