import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './CarsAdminLoader';

/**
 * Cars admin pane — Wave 7b. Lives under `/admin/content/cars`.
 *
 * admin-module-composed: the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded panel directly. `./CarsAdminLoader` is
 * side-imported so the `content/cars` bridge registers at load.
 */
const CarsPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'content/cars'});

export class CarsAdminUILoader extends AdminUILoader {
    readonly id = 'cars';
    readonly displayName = 'Cars';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/cars',
        title: 'Cars',
        route: '/admin/content/cars',
        modes: {advanced: CarsPaneDispatch},
    };
}
