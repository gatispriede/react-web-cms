import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './ProductTemplatesAdminLoader';

/**
 * Product Templates admin pane — lives under `content/product-templates`
 * alongside Products. Phase 1.F (product-display-templates).
 *
 * admin-module-composed: the pane is now module-composed — both modes
 * dispatch through the `AdminPageRegistry` instead of rendering the
 * hand-coded panel directly. `./ProductTemplatesAdminLoader` is
 * side-imported so the `content/product-templates` bridge registers at
 * load.
 */
const ProductTemplatesPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'content/product-templates'});

export class ProductTemplatesAdminUILoader extends AdminUILoader {
    readonly id = 'productTemplates';
    readonly displayName = 'Product Templates';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/product-templates',
        title: 'Product templates',
        route: '/admin/content/product-templates',
        modes: {
            simplified: ProductTemplatesPaneDispatch,
            advanced: ProductTemplatesPaneDispatch,
        },
    };
}
