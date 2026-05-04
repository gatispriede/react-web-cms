import {ClientUILoader, ClientPublicRoute} from '@client/lib/loaders/ClientUILoader';

/**
 * Posts (blog) feature — public routes (Class Loader L4).
 *
 * The blog index and post detail pages are gated by the `posts` feature
 * flag. Today the page files don't call `withFeatureGate` at all
 * (blog 404s naturally when no posts exist); declaring the routes here
 * lets a future helper apply the gate uniformly without page edits.
 */
export class PostsClientUILoader extends ClientUILoader {
    readonly id = 'posts';
    readonly displayName = 'Blog';

    readonly publicRoutes: readonly ClientPublicRoute[] = [
        {path: '/blog'},
        {path: '/blog/[slug]'},
    ];
}
