import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import type {FunctionalRoleDescriptor} from '@interfaces/IPermission';
import {PostService} from './PostService';

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
