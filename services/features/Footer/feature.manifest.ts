import type {FeatureManifest} from '@services/infra/featureManifest';
import {FooterServiceLoader} from './FooterServiceLoader';

export const footerFeature: FeatureManifest = new FooterServiceLoader().toManifest();
