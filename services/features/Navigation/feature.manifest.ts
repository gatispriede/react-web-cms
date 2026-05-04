import type {FeatureManifest} from '@services/infra/featureManifest';
import {NavigationServiceLoader} from './NavigationServiceLoader';

export const navigationFeature: FeatureManifest = new NavigationServiceLoader().toManifest();
