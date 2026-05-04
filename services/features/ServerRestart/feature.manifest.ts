import type {FeatureManifest} from '@services/infra/featureManifest';
import {ServerRestartServiceLoader} from './ServerRestartServiceLoader';

export const serverRestartFeature: FeatureManifest = new ServerRestartServiceLoader().toManifest();
