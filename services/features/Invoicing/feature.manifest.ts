import type {FeatureManifest} from '@services/infra/featureManifest';
import {InvoicingServiceLoader} from './InvoicingServiceLoader';

export const invoicingFeature: FeatureManifest = new InvoicingServiceLoader().toManifest();
