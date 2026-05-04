import type {FeatureManifest} from '@services/infra/featureManifest';
import {CartServiceLoader} from './CartServiceLoader';

export const cartFeature: FeatureManifest = new CartServiceLoader().toManifest();
