/**
 * Modules-preview admin pane. Mounted at `/admin/modules-preview`.
 *
 * admin-module-composed: the `modules-preview` pane has no hand-coded
 * feature component of its own — its bridge is
 * `ui/client/lib/preview/ModulesPreview.tsx`, registered with the
 * `AdminPageRegistry` by `./ModulesPreviewAdminLoader` (side-imported
 * here). `modes.advanced` dispatches through the registry via
 * `AdminPageDispatch` instead of rendering the legacy component
 * directly; the `UserStatusBar` switch keeps a `modules-preview` case
 * as a fallback.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './ModulesPreviewAdminLoader';

const ModulesPreviewPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'modules-preview'});

export class ModulesPreviewAdminUILoader extends AdminUILoader {
    readonly id = 'modules-preview';
    readonly displayName = 'Modules preview';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'modules-preview',
        title: 'Modules preview',
        route: '/admin/modules-preview',
        modes: {advanced: ModulesPreviewPaneDispatch},
        advancedOnly: true,
    };
}
