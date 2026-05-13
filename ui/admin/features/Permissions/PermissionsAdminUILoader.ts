import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';

/**
 * Permissions pane. Replaces the per-action checkbox / multiselect grid
 * (which lived embedded in the Users pane) with the Notion-3.0-shaped
 * tier UX — 4 named tiers + role presets + per-resource overrides.
 *
 * Per `aui-mode-hierarchy.md` (2026-05-07): Simplified is the tier grid
 * + preset picker; Advanced composes that base + per-resource override
 * disclosure. Both share the same VM so cells edit the same state.
 *
 * Both variants are `React.lazy`-imported so simplified-mode users
 * never download the advanced bundle.
 */
const PermissionsAdvanced = React.lazy(() => import('./PermissionsAdvancedView'));
const PermissionsSimplified = React.lazy(() => import('./PermissionsSimplifiedView'));

export class PermissionsAdminUILoader extends AdminUILoader {
    readonly id = 'permissions';
    readonly displayName = 'Permissions';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/permissions',
        title: 'Permissions',
        route: '/admin/system/permissions',
        modes: {
            advanced: PermissionsAdvanced,
            simplified: PermissionsSimplified,
        },
    };
}
