import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './ThemeAdminLoader';

/**
 * Themes pane. Both modes share `ThemesViewModel` (admin-ui-modes
 * decision 4). Simplified is a preset gallery — pick one, click
 * Activate. Advanced composes the simplified base (per
 * `aui-mode-hierarchy.md` 2026-05-07) and adds the token editor with
 * color / font pickers.
 *
 * admin-module-composed: the pane is now module-composed — BOTH modes
 * dispatch through the `AdminPageRegistry` via `AdminPageDispatch`. The
 * registered `ThemeAdminLoader` bridge reads `useAdminMode()` and picks
 * the simplified vs advanced view internally, so both slots point at the
 * same dispatch component. `./ThemeAdminLoader` is side-imported so the
 * `client-config/themes` bridge registers at load.
 */
const ThemePaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'client-config/themes'});

export class ThemeAdminUILoader extends AdminUILoader {
    readonly id = 'themes';
    readonly displayName = 'Themes';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'client-config/themes',
        title: 'Theme',
        route: '/admin/client-config/themes',
        modes: {
            advanced: ThemePaneDispatch,
            simplified: ThemePaneDispatch,
        },
    };
}
