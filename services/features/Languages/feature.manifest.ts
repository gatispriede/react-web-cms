import type {FeatureManifest} from '@services/infra/featureManifest';
import {LanguagesServiceLoader} from './LanguagesServiceLoader';

export const languagesFeature: FeatureManifest = new LanguagesServiceLoader().toManifest();
