import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import OnboardingWizard from './OnboardingWizard';

/**
 * Q7 — Onboarding pane registration. Lives at `/admin/onboarding`;
 * served only when `isFreshInstall()` returns true (gated SSR-side).
 * Sidebar entries hide the pane via `advancedOnly` since the wizard
 * is one-shot and not a discoverable feature post-bootstrap.
 */
export class OnboardingAdminUILoader extends AdminUILoader {
    readonly id = 'onboarding';
    readonly displayName = 'Onboarding';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'onboarding',
        title: 'Onboarding',
        route: '/admin/onboarding',
        modes: {advanced: OnboardingWizard as any},
        advancedOnly: true,
    };
}
