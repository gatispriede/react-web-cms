import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import Templates from './Templates';

/**
 * W6a — Email Templates preview pane (`/admin/system/email-templates`).
 *
 * Lists every registered transactional template (receipt, order-confirm,
 * shipped, magic-link, password-reset, account-welcome) and renders
 * them against the bundled fixture inside a sandboxed iframe. Operators
 * pick a template and click "Send test" to ship it through the active
 * provider via `/api/email/test`.
 */
export class EmailTemplatesAdminUILoader extends AdminUILoader {
    readonly id = 'email-templates';
    readonly displayName = 'Email templates';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/email-templates',
        title: 'Email templates',
        route: '/admin/system/email-templates',
        modes: {advanced: Templates},
    };
}
