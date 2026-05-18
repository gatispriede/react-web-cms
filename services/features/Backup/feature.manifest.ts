import type {FeatureManifest} from '@services/infra/featureManifest';
import {BackupServiceLoader} from './BackupServiceLoader';

export const backupFeature: FeatureManifest = new BackupServiceLoader().toManifest();

export default backupFeature;
