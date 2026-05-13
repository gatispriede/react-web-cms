import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';

/**
 * Themes pane. Both modes share `ThemesViewModel` (admin-ui-modes
 * decision 4). Simplified is a preset gallery — pick one, click
 * Activate. Advanced composes the simplified base (per
 * `aui-mode-hierarchy.md` 2026-05-07) and adds the token editor with
 * color / font pickers.
 *
 * Both variants are `React.lazy`-imported so simplified-mode users
 * never download the advanced bundle (and vice versa). The shell
 * dispatcher wraps the active pane in `<Suspense>`.
 */
const ThemeAdvanced = React.lazy(() => import('./ThemeAdvancedView'));
const ThemeSimplified = React.lazy(() => import('./ThemeSimplifiedView'));

export class ThemeAdminUILoader extends AdminUILoader {
    readonly id = 'themes';
    readonly displayName = 'Themes';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'client-config/themes',
        title: 'Theme',
        route: '/admin/client-config/themes',
        modes: {
            advanced: ThemeAdvanced,
            simplified: ThemeSimplified,
        },
    };
}
