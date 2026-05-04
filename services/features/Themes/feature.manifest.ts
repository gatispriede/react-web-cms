import type {FeatureManifest} from '@services/infra/featureManifest';
import {ThemesServiceLoader} from './ThemesServiceLoader';

/**
 * Themes feature manifest — Class Loader L3 (2026-05-02).
 * Thin re-export so the codegen scan keeps working unchanged.
 */
export const themesFeature: FeatureManifest = new ThemesServiceLoader().toManifest();
