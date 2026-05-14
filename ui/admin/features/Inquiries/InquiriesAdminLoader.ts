/**
 * admin-module-composed (Batch 2) — Inquiries `AdminLoader` bridge.
 *
 * Registers the `system/inquiries` pane with the `AdminPageRegistry`.
 * The bridge component (`Inquiries.tsx`) wires `InquiriesViewModel` to
 * a single `AdminCrudList` view-module slot, keeping the bespoke detail
 * Modal + the pull-to-refresh wrapper rendered alongside. Self-registers
 * on import; `InquiriesAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import Inquiries from './Inquiries';

export class InquiriesAdminLoader extends AdminLoader {
    readonly paneId = 'system/inquiries';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = Inquiries;
}

adminPageRegistry.register(new InquiriesAdminLoader());
