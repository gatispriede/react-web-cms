import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './PostsAdminLoader';

/**
 * Posts admin pane.
 *
 * Both modes share `PostsViewModel` (admin-ui-modes decision 4).
 * Simplified strips draft / slug / tags / author / excerpt / blog-visible;
 * every save publishes. Advanced composes the simplified base (per
 * `aui-mode-hierarchy.md` 2026-05-07) and adds the full surface.
 *
 * admin-module-composed: the pane is now module-composed — BOTH modes
 * dispatch through the `AdminPageRegistry` via `AdminPageDispatch`. The
 * registered `PostsAdminLoader` bridge reads `useAdminMode()` and picks
 * the simplified vs advanced view internally, so both slots point at the
 * same dispatch component. `./PostsAdminLoader` is side-imported so the
 * `content/posts` bridge registers at load.
 */
const PostsPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'content/posts'});

export class PostsAdminUILoader extends AdminUILoader {
    readonly id = 'posts';
    readonly displayName = 'Posts';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/posts',
        title: 'Posts',
        route: '/admin/content/posts',
        modes: {
            advanced: PostsPaneDispatch,
            simplified: PostsPaneDispatch,
        },
    };
}
