import type {FeatureManifest} from '@services/infra/featureManifest';
import {CheckoutFeatureLoader} from './CheckoutFeatureLoader';

/**
 * checkout-as-composable-page (Phase 1.D) — Checkout feature manifest.
 * Sibling to Cart / Orders / CustomerAuth. Owns the 8 system-page
 * registrations for cart + checkout flow + order-by-token + account
 * dashboard + magic-link-verify.
 */
export const checkoutFeature: FeatureManifest = new CheckoutFeatureLoader().toManifest();
