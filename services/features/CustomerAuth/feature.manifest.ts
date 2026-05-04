import type {FeatureManifest} from '@services/infra/featureManifest';
import {CustomerAuthServiceLoader} from './CustomerAuthServiceLoader';

export const customerAuthFeature: FeatureManifest = new CustomerAuthServiceLoader().toManifest();
