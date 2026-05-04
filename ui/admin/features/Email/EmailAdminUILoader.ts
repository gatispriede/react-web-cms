import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import Email from './Email';

/**
 * Email-provider config pane (admin → System → Email). Replaces env-only
 * SMTP config with admin-configurable, provider-pluggable transport
 * (SMTP / Resend / Disabled). Secrets encrypted at rest via SECRETBOX_KEY.
 */
export class EmailAdminUILoader extends AdminUILoader {
    readonly id = 'email';
    readonly displayName = 'Email';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/email',
        title: 'Email',
        route: '/admin/system/email',
        modes: {advanced: Email},
    };
}
