/**
 * admin-module-composed — Footer `AdminLoader` bridge.
 *
 * Registers the `site/footer` pane with the `AdminPageRegistry`. The
 * Footer pane is a single-doc config surface (enable switch + column
 * grid + bottom line + ConflictDialog), not a clean CRUD list — it
 * doesn't reduce to `AdminCrudListModule`, so the bridge keeps its
 * bespoke JSX. The slot is declared as `AdminForm` (the closest shape:
 * a single-doc editor with an audit badge + save bar). `FooterViewModel`
 * is unchanged. Self-registers on import; `FooterAdminUILoader`
 * side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import Footer from './Footer';

export class FooterAdminLoader extends AdminLoader {
    readonly paneId = 'settings/chrome/footer';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminForm, locked: true},
    ];
    readonly Bridge = Footer;
}

adminPageRegistry.register(new FooterAdminLoader());
