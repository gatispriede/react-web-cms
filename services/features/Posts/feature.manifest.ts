import type {FeatureManifest} from '@services/infra/featureManifest';
import {PostsServiceLoader} from './PostsServiceLoader';

export const postsFeature: FeatureManifest = new PostsServiceLoader().toManifest();
