/**
 * admin-module-composed — Modules-preview `AdminLoader` bridge.
 *
 * Registers the `modules-preview` pane with the `AdminPageRegistry`. The
 * bridge component (`ui/client/lib/preview/ModulesPreview.tsx` — it
 * lives under `ui/client/lib/preview/`, not `ui/admin/features/`) keeps
 * the module × style × sample matrix logic unchanged and composes a
 * single `AdminPreview` view-module slot: the theme picker / transparent
 * toggle / filter toolbar in `controls`, the `<Collapse>` matrix in
 * `children`. Self-registers on import; `ModulesPreviewAdminUILoader`
 * side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import ModulesPreview from '@client/lib/preview/ModulesPreview';

export class ModulesPreviewAdminLoader extends AdminLoader {
    readonly paneId = 'modules-preview';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminPreview, locked: true},
    ];
    readonly Bridge = ModulesPreview;
}

adminPageRegistry.register(new ModulesPreviewAdminLoader());
