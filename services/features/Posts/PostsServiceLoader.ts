import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import type {FunctionalRoleDescriptor} from '@interfaces/IPermission';
import {BatchLoader} from '@services/infra/BatchLoader';
import {PostService} from './PostService';
import type {IPost} from '@interfaces/IPost';

/**
 * Posts Loader — Class Loader L3 migration of `postsFeature`.
 * Single-arg ctor, no indexes, no special lifecycle.
 */
export class PostsServiceLoader extends ServiceLoader {
    readonly id = 'posts';
    readonly displayName = 'Posts';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {posts: new PostService(ctx.db)};
    }

    readonly schemaSDL = `extend type QueryMongo {
    getPosts(includeDrafts: Boolean, limit: Int): String!
    getPost(slug: String!, includeDrafts: Boolean): String
}
extend type MutationMongo {
    savePost(post: JSON!, expectedVersion: Int): String!
    deletePost(id: String!): String!
    setPostPublished(id: String!, publish: Boolean!): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        mutationRequirements: {
            savePost: 'editor',
            deletePost: 'editor',
            setPostPublished: 'editor',
        },
        sessionInjected: [
            'savePost',
            'deletePost',
            'setPostPublished',
        ],
        // Q10 — gate Posts mutations on {feature, page}. Admin rank bypasses.
        // Page extracted from `args.post.slug` (savePost) or args.id (deletePost
        // / setPostPublished — id doubles as slug for the page-grant check).
        resourceGated: {
            savePost: (args: any) => ({
                dimensions: ['feature', 'page'] as const,
                values: {feature: 'Posts', page: args?.post?.slug ?? args?.pageSlug ?? ''},
            }),
            deletePost: (args: any) => ({
                dimensions: ['feature', 'page'] as const,
                values: {feature: 'Posts', page: args?.id ?? args?.pageSlug ?? ''},
            }),
            setPostPublished: (args: any) => ({
                dimensions: ['feature', 'page'] as const,
                values: {feature: 'Posts', page: args?.id ?? args?.pageSlug ?? ''},
            }),
        },
    };

    /**
     * Cache-version keys this feature owns. Bumped on `savePost`,
     * `deletePost`, `setPostPublished` via `runMutation`. The same
     * keys appear in the public response's `X-Cms-Cache-Tag` so Caddy
     * SWR entries evict on admin write.
     */
    readonly cacheVersionKeys: readonly string[] = ['posts'];

    /**
     * Request-scoped batched accessors. `byId` is the demo loader for
     * C9 — `Promise.all(ids.map(id => loader.load(id)))` folds into a
     * single `getManyByIds` call regardless of the fan-out shape.
     */
    readonly batchAccessors = {
        byId: (ctx: FeatureContext) => {
            const svc = ctx.services.posts as PostService | undefined;
            return new BatchLoader<string, IPost>(async (ids) => {
                if (!svc) return ids.map(() => null);
                return svc.getManyByIds(ids);
            });
        },
    };

    /**
     * `content-editor` functional role — declared here because Posts is
     * the canonical content surface; Navigation/Sections also key off it.
     * Assignable so the admin "assign roles" UI surfaces it.
     */
    readonly functionalRoles: readonly FunctionalRoleDescriptor[] = [
        {
            id: 'content-editor',
            displayName: 'Content editor',
            assignable: true,
            grants: {
                posts: 'edit',
                pages: 'edit',
                modules: 'edit',
            },
        },
    ];
}
