import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import Posts from './Posts';
import PostsSimplifiedView from './PostsSimplifiedView';

/**
 * Posts admin pane.
 *
 * Both modes share `PostsViewModel` (admin-ui-modes decision 4).
 * Simplified strips draft / slug / tags / author / excerpt / blog-visible;
 * every save publishes. Advanced is the full surface.
 */
export class PostsAdminUILoader extends AdminUILoader {
    readonly id = 'posts';
    readonly displayName = 'Posts';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/posts',
        title: 'Posts',
        route: '/admin/content/posts',
        modes: {
            advanced: Posts,
            simplified: PostsSimplifiedView,
        },
    };
}
