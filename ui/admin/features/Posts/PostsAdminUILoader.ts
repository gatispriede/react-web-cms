import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import Posts from './Posts';

/**
 * Posts admin pane — first AdminUILoader proof case (Class Loader L4).
 *
 * For now only the `advanced` mode is wired; `simplified` will be a
 * cut-down view (single-column, fewer fields) once `admin-ui-modes` is
 * implemented. Both will read from the same `PostsViewModel` per
 * `docs/features/platform/admin-ui-modes.md` (decision 4 — VM is shared).
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
        },
    };
}
