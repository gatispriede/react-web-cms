import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import Theme from './Theme';
import ThemeSimplifiedView from './ThemeSimplifiedView';

/**
 * Themes pane. Both modes share `ThemesViewModel` (admin-ui-modes
 * decision 4). Simplified is a preset gallery — pick one, click
 * Activate. Advanced is the token editor with color / font pickers.
 */
export class ThemeAdminUILoader extends AdminUILoader {
    readonly id = 'themes';
    readonly displayName = 'Themes';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'client-config/themes',
        title: 'Theme',
        route: '/admin/client-config/themes',
        modes: {
            advanced: Theme,
            simplified: ThemeSimplifiedView,
        },
    };
}
