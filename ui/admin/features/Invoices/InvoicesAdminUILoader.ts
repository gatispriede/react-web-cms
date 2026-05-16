/**
 * AdminUILoader for the `commerce/invoices` pane.
 *
 * Registers `/admin/commerce/invoices` with the AdminShell registry.
 * Single render path — the pane is small enough that the
 * AdminPageRegistry / AdminCrudListModule wrapping pattern would add
 * more code than it saves; the pane mounts its own `InvoicesListPane`
 * which already speaks the `AdminCrud` shape directly.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import InvoicesListPane from './InvoicesListPane';

const InvoicesPaneDispatch: React.FC = () => React.createElement(InvoicesListPane);

export class InvoicesAdminUILoader extends AdminUILoader {
    readonly id = 'invoices';
    readonly displayName = 'Invoices';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'commerce/invoices',
        title: 'Invoices',
        route: '/admin/commerce/invoices',
        modes: {advanced: InvoicesPaneDispatch},
    };
}
