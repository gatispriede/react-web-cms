import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './PermissionsAdminLoader';

/**
 * Permissions pane. Replaces the per-action checkbox / multiselect grid
 * (which lived embedded in the Users pane) with the Notion-3.0-shaped
 * tier UX — 4 named tiers + role presets + per-resource overrides.
 *
 * Per `aui-mode-hierarchy.md` (2026-05-07): Simplified is the tier grid
 * + preset picker; Advanced composes that base + per-resource override
 * disclosure. Both share the same VM so cells edit the same state.
 *
 * admin-module-composed: the pane is now module-composed — BOTH modes
 * dispatch through the `AdminPageRegistry` via `AdminPageDispatch`. The
 * registered `PermissionsAdminLoader` bridge reads `useAdminMode()` and
 * picks the simplified vs advanced view internally, so both slots point
 * at the same dispatch component. `./PermissionsAdminLoader` is
 * side-imported so the `system/permissions` bridge registers at load.
 */
const PermissionsPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/permissions'});

export class PermissionsAdminUILoader extends AdminUILoader {
    readonly id = 'permissions';
    readonly displayName = 'Permissions';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/permissions',
        title: 'Permissions',
        route: '/admin/system/permissions',
        modes: {
            advanced: PermissionsPaneDispatch,
            simplified: PermissionsPaneDispatch,
        },
    };
}
