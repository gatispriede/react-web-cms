/**
 * admin-module-composed — Onboarding `AdminLoader` bridge.
 *
 * Registers the `onboarding` pane with the `AdminPageRegistry`. The
 * bridge component (`OnboardingWizard.tsx`) wires `OnboardingViewModel`
 * to a single `AdminWizard` view-module slot. Self-registers on import;
 * `OnboardingAdminUILoader` side-imports this file.
 *
 * `OnboardingWizard` takes an optional `onComplete` prop, so it mounts
 * zero-prop as the bridge directly.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import OnboardingWizard from './OnboardingWizard';

export class OnboardingAdminLoader extends AdminLoader {
    readonly paneId = 'onboarding';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminWizard, locked: true},
    ];
    readonly Bridge = OnboardingWizard;
}

adminPageRegistry.register(new OnboardingAdminLoader());
