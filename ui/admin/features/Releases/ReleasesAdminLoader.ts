/**
 * admin-module-composed — Releases `AdminLoader` bridge.
 *
 * Registers the `release/releases` pane with the `AdminPageRegistry`.
 * Releases is a dual-mode master-detail pane (release list + a
 * member-table detail panel with create / attach / publish / rollback
 * controls), not a clean CRUD list — it doesn't reduce to
 * `AdminCrudListModule`, so the bridge keeps the bespoke
 * `ReleasesSimplified` / `ReleasesAdvanced` views. The bridge reads
 * `useAdminMode()` and renders the simplified or advanced view. The slot
 * is declared as `AdminCrudList` (the closest shape: the release list is
 * the primary surface). `ReleasesViewModel` is unchanged.
 *
 * Self-registers on import; `ReleasesAdminUILoader` side-imports this
 * file and points BOTH modes at `AdminPageDispatch` — the bridge handles
 * the mode split internally.
 */
import React from 'react';
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import {useAdminMode} from '@admin/lib/adminMode';
import ReleasesSimplified from './ReleasesSimplified';
import ReleasesAdvanced from './ReleasesAdvanced';

const ReleasesBridge: React.FC = () => {
    const {mode} = useAdminMode();
    return mode === 'simplified'
        ? React.createElement(ReleasesSimplified)
        : React.createElement(ReleasesAdvanced);
};

export class ReleasesAdminLoader extends AdminLoader {
    readonly paneId = 'release/releases';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = ReleasesBridge;
}

adminPageRegistry.register(new ReleasesAdminLoader());
