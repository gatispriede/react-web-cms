/**
 * Shell re-export of the existing `<EmptyState>` — `admin-information-architecture`
 * jump.
 *
 * The component itself ships from `ui/admin/lib/EmptyState.tsx` (where it
 * landed during the `admin-empty-states-onboarding` jump). The IA jump
 * canonicalises shell-level imports under `ui/admin/shell/*` so panes can
 * pull `<PaneHeader>`, `<EmptyState>`, `<SaveBar>` from a single home.
 *
 * The legacy `@admin/lib/EmptyState` import path keeps working — both
 * point at the same component — so the per-area sweep agents only need
 * to swap headers and savebars without touching empty states.
 */
export {default, onboardingCta} from '@admin/lib/EmptyState';
export type {EmptyStateProps, EmptyStateAction} from '@admin/lib/EmptyState';
