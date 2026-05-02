import type {FeatureManifest} from '@services/infra/featureManifest';
import {PublishingServiceLoader} from './PublishingServiceLoader';

export const publishingFeature: FeatureManifest = new PublishingServiceLoader().toManifest();
