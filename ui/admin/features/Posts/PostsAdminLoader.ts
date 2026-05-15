/**
 * admin-module-composed — Posts `AdminLoader` bridge.
 *
 * Registers the `content/posts` pane with the `AdminPageRegistry`. Posts
 * is a dual-mode pane: the bridge reads `useAdminMode()` and renders the
 * simplified or advanced view, each of which composes the generic
 * `AdminCrudList` view-module shape (+ keeps its bespoke edit Drawer /
 * ConflictDialog). `PostsViewModel` is unchanged.
 *
 * Self-registers on import; `PostsAdminUILoader` side-imports this file
 * and points BOTH modes at `AdminPageDispatch` — the bridge handles the
 * mode split internally.
 */
import React from 'react';
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import {useAdminMode} from '@admin/lib/adminMode';
import PostsSimplifiedView from './PostsSimplifiedView';
import PostsAdvancedView from './PostsAdvancedView';

const PostsBridge: React.FC = () => {
    const {mode} = useAdminMode();
    return mode === 'simplified'
        ? React.createElement(PostsSimplifiedView)
        : React.createElement(PostsAdvancedView);
};

export class PostsAdminLoader extends AdminLoader {
    readonly paneId = 'content/posts';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = PostsBridge;
}

adminPageRegistry.register(new PostsAdminLoader());
