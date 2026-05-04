import type {FeatureManifest} from '@services/infra/featureManifest';
import {DiagnosticsServiceLoader} from './DiagnosticsServiceLoader';

export const diagnosticsFeature: FeatureManifest = new DiagnosticsServiceLoader().toManifest();
