/**
 * Inline-edit dispatch resolver — the parent-side half of the
 * `data-edit-target` round-trip.
 *
 * The public render side stamps `data-edit-target="<collection>/<id>/<field>"`
 * onto every content-bearing element (see `ui/client/lib/inlineEditAttr.ts`).
 * `useInlineEdit` intercepts the click in the admin shell and parses the
 * attribute back into an `InlineEditTarget`. This module is the last leg:
 * it decides *where the operator should land* for a given target.
 *
 * Two dispatch shapes, by collection:
 *
 *   - `modules` / `sections` — these live inside the page the operator is
 *     already looking at (the build view renders the public page in-place,
 *     no iframe). The fast path is the in-place `<InlineEditDrawer/>`, so
 *     `resolveEditTarget` returns `{kind: 'drawer'}` and the overlay opens
 *     the drawer. A secondary "open full editor" deep-link is still offered
 *     for compound fields the drawer can't handle (image/link pickers).
 *
 *   - `pages` / `posts` / `products` — these have their own dedicated admin
 *     editor panes at real routes. `resolveEditTarget` returns
 *     `{kind: 'route', href}` and the overlay navigates there, threading the
 *     clicked field through as `?focus=<field>` (+ `?editId=<id>` for the
 *     list-style panes) so the destination pane can scroll + focus the
 *     matching input on mount. Consuming `?focus=` inside each pane is a
 *     per-feature follow-up — the panes live under `ui/admin/features/*`;
 *     this resolver closes the loop up to the route boundary.
 *
 * Keeping the mapping here (one tiny pure module, fully unit-testable)
 * rather than inline in the overlay means a new editable collection only
 * touches this file + the shared `InlineEditCollection` union.
 */
import type {InlineEditTarget, InlineEditCollection} from '@interfaces/InlineEdit';

/** The overlay should open its in-place quick-edit drawer. */
export interface DrawerDispatch {
    kind: 'drawer';
    /** Optional deep-link to the collection's full editor, for fields the
     *  lightweight drawer can't handle. `undefined` when there is no
     *  better surface than the drawer itself. */
    fullEditorHref?: string;
}

/** The overlay should navigate to a dedicated editor route. */
export interface RouteDispatch {
    kind: 'route';
    /** Absolute admin route incl. focus query params. */
    href: string;
}

export type EditTargetDispatch = DrawerDispatch | RouteDispatch;

/**
 * Base admin route per collection. `modules`/`sections` resolve to the
 * build view (the page editor) since that's where their owning page is
 * edited. `pages` also lives in the build view. `posts`/`products` have
 * standalone panes.
 */
const COLLECTION_ROUTE: Record<InlineEditCollection, string> = {
    modules: '/admin/build',
    sections: '/admin/build',
    pages: '/admin/build',
    posts: '/admin/content/posts',
    products: '/admin/content/products',
};

/**
 * Build the `?focus=…` (+ `?editId=…`) query string the destination pane
 * uses to scroll + focus the right input. `editId` is only meaningful for
 * the list-style panes (posts/products) where the pane has to first open
 * the row's editor; the build view already shows every section inline so
 * it only needs `focus`.
 */
export function buildFocusQuery(target: InlineEditTarget, includeEditId: boolean): string {
    const params = new URLSearchParams();
    if (target.field) params.set('focus', target.field);
    if (includeEditId && target.id) params.set('editId', target.id);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

/**
 * Resolve an `InlineEditTarget` to a dispatch decision. Pure — no DOM, no
 * navigation side effects; the overlay performs the actual drawer-open or
 * route-push so this stays trivially testable.
 */
export function resolveEditTarget(target: InlineEditTarget): EditTargetDispatch {
    const base = COLLECTION_ROUTE[target.collection];
    switch (target.collection) {
        case 'modules':
        case 'sections':
            // In-place drawer is the fast path. The "full editor" deep-link
            // points at the build view with the module id + field threaded
            // through — the escape hatch for compound fields the
            // lightweight drawer can't handle (image / link pickers, list
            // reordering). It's a real navigation even though the build
            // view may already be open: the `?editId`/`?focus` params are
            // what makes the destination pane scroll + open the right row.
            return {
                kind: 'drawer',
                fullEditorHref: `${base}${buildFocusQuery(target, true)}`,
            };
        case 'pages':
            // Page-level fields (slug/title/parent) — the build view owns
            // the page tree; deep-link there with the field hint.
            return {kind: 'route', href: `${base}${buildFocusQuery(target, false)}`};
        case 'posts':
        case 'products':
            // Dedicated list-style panes — thread both the row id and the
            // field so the pane can open the row + focus the input.
            return {kind: 'route', href: `${base}${buildFocusQuery(target, true)}`};
        default: {
            // Exhaustiveness guard — a new collection added to the shared
            // union without a branch here is a compile error.
            const _exhaustive: never = target.collection;
            return {kind: 'route', href: `${COLLECTION_ROUTE[_exhaustive] ?? '/admin/build'}`};
        }
    }
}

/**
 * Human-readable label for the dispatch — used for the drawer's
 * "open full editor" button text + the navigate toast. Kept here so the
 * collection→copy mapping has one home.
 */
export function dispatchLabel(target: InlineEditTarget): string {
    switch (target.collection) {
        case 'posts': return 'post editor';
        case 'products': return 'product editor';
        case 'pages': return 'page editor';
        default: return 'editor';
    }
}
