import type {FeatureManifest} from '@services/infra/featureManifest';
import {PlatformServiceLoader} from './PlatformServiceLoader';

export const platformFeature: FeatureManifest = new PlatformServiceLoader().toManifest();

export default platformFeature;
