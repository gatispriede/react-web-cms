import type {FeatureManifest} from '@services/infra/featureManifest';
import {NotificationsServiceLoader} from './NotificationsServiceLoader';

/**
 * W8f — Customer notifications feature manifest.
 * Per-category opt-in/out, quiet hours, digest cadence, in-app inbox,
 * RFC 8058 one-click unsubscribe integration.
 */
export const notificationsFeature: FeatureManifest = new NotificationsServiceLoader().toManifest();
