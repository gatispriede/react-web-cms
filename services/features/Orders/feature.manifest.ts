import type {FeatureManifest} from '@services/infra/featureManifest';
import {OrdersServiceLoader} from './OrdersServiceLoader';

export const ordersFeature: FeatureManifest = new OrdersServiceLoader().toManifest();
