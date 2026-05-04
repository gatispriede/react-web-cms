import type {FeatureManifest} from '@services/infra/featureManifest';
import {OnboardingServiceLoader} from './OnboardingServiceLoader';

export const onboardingFeature: FeatureManifest = new OnboardingServiceLoader().toManifest();
