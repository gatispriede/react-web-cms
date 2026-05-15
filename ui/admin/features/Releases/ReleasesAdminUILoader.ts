import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './ReleasesAdminLoader';

/**
 * Content Releases admin pane — admin-content-releases.md. Lives under
 * `release/releases` alongside Bundle + Trash. Simplified covers the
 * happy-path editorial flow (list / create / attach / publish);
 * Advanced adds rollback + perspective preview metadata.
 *
 * admin-module-composed: the pane is now module-composed — both modes
 * dispatch through the `AdminPageRegistry` instead of rendering the
 * hand-coded panes directly. The `ReleasesBridge` handles the
 * simplified / advanced split internally via `useAdminMode()`.
 * `./ReleasesAdminLoader` is side-imported so the `release/releases`
 * bridge registers at load.
 */
const ReleasesPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'release/releases'});

export class ReleasesAdminUILoader extends AdminUILoader {
    readonly id = 'releases';
    readonly displayName = 'Releases';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'release/releases',
        title: 'Releases',
        route: '/admin/release/releases',
        modes: {
            simplified: ReleasesPaneDispatch,
            advanced: ReleasesPaneDispatch,
        },
    };
}
