import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './OnboardingAdminLoader';

/**
 * Q7 — Onboarding pane registration. Lives at `/admin/onboarding`;
 * served only when `isFreshInstall()` returns true (gated SSR-side).
 * Sidebar entries hide the pane via `advancedOnly` since the wizard
 * is one-shot and not a discoverable feature post-bootstrap.
 *
 * admin-module-composed: the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded wizard directly. `./OnboardingAdminLoader`
 * is side-imported so the `onboarding` bridge registers at load.
 */
const OnboardingPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'onboarding'});

export class OnboardingAdminUILoader extends AdminUILoader {
    readonly id = 'onboarding';
    readonly displayName = 'Onboarding';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'onboarding',
        title: 'Onboarding',
        route: '/admin/onboarding',
        modes: {advanced: OnboardingPaneDispatch},
        advancedOnly: true,
    };
}
