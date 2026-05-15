import type {FeatureManifest} from '@services/infra/featureManifest';
import {CustomerServiceLoader} from './CustomerServiceLoader';

/**
 * client-account-settings-page (Phase 1.E) — Customer feature manifest.
 *
 * Sister-feature to `CustomerAuth` — auth owns identity / sign-up /
 * magic-link; this owns the extended profile (customerType, company
 * sub-record, payment methods, type-switch, VIES verification) +
 * registers the `/account/settings` system page.
 */
export const customerFeature: FeatureManifest = new CustomerServiceLoader().toManifest();
