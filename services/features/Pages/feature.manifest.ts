/**
 * Phase 1.C — Pages feature manifest.
 *
 * Wires the `PagesServiceLoader` into the codegen-driven
 * `featureRegistry.generated.ts`. The codegen scan walks every
 * `services/features/<name>/feature.manifest.ts` and re-emits the
 * registry on `npm run features:codegen`.
 */
import type {FeatureManifest} from '@services/infra/featureManifest';
import {PagesServiceLoader} from './PagesServiceLoader';

export const pagesFeature: FeatureManifest = new PagesServiceLoader().toManifest();
