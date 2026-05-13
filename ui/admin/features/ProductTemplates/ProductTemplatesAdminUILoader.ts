import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import ProductTemplatesPanel from './ProductTemplatesPanel';

/**
 * Product Templates admin pane — lives under `content/product-templates`
 * alongside Products. Phase 1.F (product-display-templates).
 */
export class ProductTemplatesAdminUILoader extends AdminUILoader {
    readonly id = 'productTemplates';
    readonly displayName = 'Product Templates';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/product-templates',
        title: 'Product templates',
        route: '/admin/content/product-templates',
        modes: {
            simplified: ProductTemplatesPanel,
            advanced: ProductTemplatesPanel,
        },
    };
}
