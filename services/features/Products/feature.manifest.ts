import type {FeatureManifest} from '@services/infra/featureManifest';
import {ProductsServiceLoader} from './ProductsServiceLoader';

/**
 * Products feature manifest — Class Loader L2 (2026-05-02).
 *
 * Migrated from a literal `FeatureManifest` to a `ProductsServiceLoader`
 * subclass. This file is kept thin so the existing codegen
 * (`tools/codegen-feature-registry.ts`) can keep discovering the
 * feature by `feature.manifest.ts` filename without learning a new
 * convention. The Loader's `.toManifest()` adapter feeds the same
 * registry pipeline; behaviour is identical.
 *
 * See `docs/features/platform/class-loader.md` for the rollout plan.
 * Other 18 features still use literal manifests (L3 will bulk-migrate).
 */
export const productsFeature: FeatureManifest = new ProductsServiceLoader().toManifest();
