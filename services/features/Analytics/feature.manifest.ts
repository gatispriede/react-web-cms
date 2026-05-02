import type {FeatureManifest} from '@services/infra/featureManifest';
import {AnalyticsServiceLoader} from './AnalyticsServiceLoader';

export const analyticsFeature: FeatureManifest = new AnalyticsServiceLoader().toManifest();
