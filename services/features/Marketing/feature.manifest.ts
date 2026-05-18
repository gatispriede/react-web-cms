import type {FeatureManifest} from '@services/infra/featureManifest';
import {MarketingServiceLoader} from './MarketingServiceLoader';

export const marketingFeature: FeatureManifest = new MarketingServiceLoader().toManifest();
