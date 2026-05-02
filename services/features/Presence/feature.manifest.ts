import type {FeatureManifest} from '@services/infra/featureManifest';
import {PresenceServiceLoader} from './PresenceServiceLoader';

export const presenceFeature: FeatureManifest = new PresenceServiceLoader().toManifest();
