import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './EmailAdminLoader';

/**
 * Email-provider config pane (admin → System → Email). Replaces env-only
 * SMTP config with admin-configurable, provider-pluggable transport
 * (SMTP / Resend / Disabled). Secrets encrypted at rest via SECRETBOX_KEY.
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry` instead of rendering the hand-coded pane directly.
 * `./EmailAdminLoader` is side-imported so the `system/email` bridge
 * registers at load.
 */
const EmailPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/email'});

export class EmailAdminUILoader extends AdminUILoader {
    readonly id = 'email';
    readonly displayName = 'Email';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/email',
        title: 'Email',
        route: '/admin/system/email',
        modes: {advanced: EmailPaneDispatch},
    };
}
