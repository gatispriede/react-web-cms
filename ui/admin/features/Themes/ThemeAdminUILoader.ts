import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import Theme from './Theme';

/**
 * Themes pane — registered through L4 even though its VM3 migration is
 * pending. Theme.tsx is a 439-line editor with token tables / font
 * picker / preview frame; its `useState` walls are a follow-up. The
 * registry just routes the route through; the legacy state stays inside
 * the component until VM3 picks it up.
 */
export class ThemeAdminUILoader extends AdminUILoader {
    readonly id = 'themes';
    readonly displayName = 'Themes';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'client-config/themes',
        title: 'Theme',
        route: '/admin/client-config/themes',
        modes: {advanced: Theme},
    };
}
