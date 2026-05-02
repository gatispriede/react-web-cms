import type {FeatureManifest} from '@services/infra/featureManifest';
import {PermissionsServiceLoader} from './PermissionsServiceLoader';

export const permissionsFeature: FeatureManifest = new PermissionsServiceLoader().toManifest();
