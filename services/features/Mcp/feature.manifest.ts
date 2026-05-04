import type {FeatureManifest} from '@services/infra/featureManifest';
import {McpServiceLoader} from './McpServiceLoader';

export const mcpFeature: FeatureManifest = new McpServiceLoader().toManifest();
