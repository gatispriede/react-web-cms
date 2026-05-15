/**
 * Navigation side-effect for the inline-edit round-trip.
 *
 * `editTargetRoute.ts` is the *pure* resolver: it maps an `InlineEditTarget`
 * to a dispatch decision (`drawer` | `route`). This companion module is the
 * one impure piece — it performs the actual SPA-ish navigation for a
 * `route` dispatch. Kept separate so `editTargetRoute.ts` stays trivially
 * unit-testable (no DOM, no `window`) while the overlay just calls
 * `navigateToEditTarget()` and forgets about the mechanics.
 *
 * Why `window.location.assign` rather than `next/router`: the admin shell
 * (`AdminApp`) is a class component mounted outside the per-page Next
 * router tree — it already uses `window.location.replace` for cross-area
 * navigation (see `AdminApp.tsx` onboarding redirect). The editor panes
 * (`/admin/build`, `/admin/content/posts`, `/admin/content/products`) are
 * separate Next pages, so landing on them is a real navigation regardless.
 * `assign` (not `replace`) keeps the preview page in the back-stack so the
 * operator can bounce back after the edit.
 *
 * The destination pane reads the threaded `?focus=<field>` (+ `?editId=`
 * for the list-style panes) to scroll + focus the matching input on mount
 * — that consumption is a per-feature follow-up under `ui/admin/features/*`;
 * this module closes the loop up to the route boundary.
 */
import type {InlineEditTarget} from '@interfaces/InlineEdit';
import {resolveEditTarget, type EditTargetDispatch} from './editTargetRoute';

/**
 * Resolve + navigate in one call. Returns the dispatch decision so the
 * caller (the overlay) can branch — `route` means "we navigated, do
 * nothing else", `drawer` means "open the in-place quick-edit drawer".
 *
 * Guarded for SSR / non-browser (`typeof window`): returns the dispatch
 * without navigating so the resolver logic is still observable in tests.
 */
export function navigateToEditTarget(target: InlineEditTarget): EditTargetDispatch {
    const dispatch = resolveEditTarget(target);
    if (dispatch.kind === 'route' && typeof window !== 'undefined') {
        window.location.assign(dispatch.href);
    }
    return dispatch;
}

/**
 * Navigate to a collection's full editor for a target the lightweight
 * drawer can't handle (image / link pickers, list reordering). Used by the
 * drawer's "Open full editor" escape hatch. No-op when the dispatch has no
 * `fullEditorHref` (the drawer *is* the best surface for that field).
 */
export function navigateToFullEditor(target: InlineEditTarget): boolean {
    const dispatch = resolveEditTarget(target);
    const href = dispatch.kind === 'drawer'
        ? dispatch.fullEditorHref
        : dispatch.href;
    if (href && typeof window !== 'undefined') {
        window.location.assign(href);
        return true;
    }
    return false;
}
