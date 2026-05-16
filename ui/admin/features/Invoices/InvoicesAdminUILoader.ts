/**
 * AdminUILoader for the `content/invoices` pane.
 *
 * Registers `/admin/content/invoices` with the AdminShell registry.
 * Re-pivoted from `/admin/commerce/invoices` on 2026-05-16 (same day
 * as the first ship) — Commerce bucket dissolved into Content for
 * the things-operators-author lists (Invoices / Orders / Products).
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
        id: 'content/invoices',
        title: 'Invoices',
        route: '/admin/content/invoices',
        modes: {advanced: InvoicesPaneDispatch},
    };
}
