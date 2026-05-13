import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';

/**
 * Redirects admin pane — W8h SEO program § redirect map.
 *
 * Single mode (no simplified/advanced split — the surface is already
 * a four-field CRUD). Lives under `/admin/system/redirects`.
 */
const Redirects = React.lazy(() => import('./Redirects'));

export class RedirectsAdminUILoader extends AdminUILoader {
    readonly id = 'redirects';
    readonly displayName = 'Redirects';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/redirects',
        title: 'Redirects',
        route: '/admin/system/redirects',
        modes: {
            advanced: Redirects,
        },
    };
}
