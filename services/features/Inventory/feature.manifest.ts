import type {FeatureManifest} from '@services/infra/featureManifest';
import {InventoryServiceLoader} from './InventoryServiceLoader';

export const inventoryFeature: FeatureManifest = new InventoryServiceLoader().toManifest();
