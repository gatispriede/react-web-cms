import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';

/**
 * Posts admin pane.
 *
 * Both modes share `PostsViewModel` (admin-ui-modes decision 4).
 * Simplified strips draft / slug / tags / author / excerpt / blog-visible;
 * every save publishes. Advanced composes the simplified base (per
 * `aui-mode-hierarchy.md` 2026-05-07) and adds the full surface.
 *
 * Both variants are `React.lazy`-imported so simplified-mode users
 * never download the advanced bundle (and vice versa). The shell
 * dispatcher wraps the active pane in `<Suspense>`.
 */
const PostsAdvanced = React.lazy(() => import('./PostsAdvancedView'));
const PostsSimplified = React.lazy(() => import('./PostsSimplifiedView'));

export class PostsAdminUILoader extends AdminUILoader {
    readonly id = 'posts';
    readonly displayName = 'Posts';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/posts',
        title: 'Posts',
        route: '/admin/content/posts',
        modes: {
            advanced: PostsAdvanced,
            simplified: PostsSimplified,
        },
    };
}
