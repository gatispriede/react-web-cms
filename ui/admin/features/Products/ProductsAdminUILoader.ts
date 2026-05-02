import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import Products from './Products';

export class ProductsAdminUILoader extends AdminUILoader {
    readonly id = 'products';
    readonly displayName = 'Products';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/products',
        title: 'Products',
        route: '/admin/content/products',
        modes: {advanced: Products},
    };
}
