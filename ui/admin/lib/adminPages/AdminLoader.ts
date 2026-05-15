/**
 * admin-module-composed — `AdminLoader` (the bridge).
 *
 * Customer pages compose pure content modules dispatched from a
 * `SystemPageRegistry`. Admin panes are VM-driven and stateful, so they
 * can't be reduced to a serialisable content blob. Instead each
 * in-scope admin pane ships an `AdminLoader` subclass — the *bridge*:
 *
 *   - `paneId`  — matches the existing `AdminPaneDescriptor.id` so the
 *     shell's `renderPane()` keeps dispatching by route, unchanged.
 *   - `slots`   — declarative list of the view-module shapes the pane
 *     composes from. Metadata for the `AdminPageRegistry` and a future
 *     admin section editor; the dispatch itself just renders `Bridge`.
 *   - `Bridge`  — a React component that instantiates the pane's
 *     ViewModel(s) and renders each slot's view module with VM-derived
 *     props. "Admin stays mostly same": the VM + service calls live
 *     here unchanged — only the rendering moves into reusable modules.
 *
 * The hand-coded `ui/admin/features/<Name>/<Name>.tsx` pane shrinks to
 * this bridge; the bespoke JSX it used to carry becomes generic
 * `ui/admin/modules/shapes/*` view modules.
 */
import type {ComponentType} from 'react';
import type {EAdminModuleType} from '@enums/EAdminModuleType';

export interface AdminModuleSlot {
    /** Which view-module shape fills this slot. */
    type: EAdminModuleType;
    /**
     * When `true`, a future admin section editor can't move or remove
     * this slot. Every slot ships locked for now — operator rearrange
     * is a follow-up; the slot list is currently canonical-layout only.
     */
    locked: boolean;
}

export abstract class AdminLoader {
    /** Matches the `AdminPaneDescriptor.id` this loader composes (e.g. `'system/info'`). */
    abstract readonly paneId: string;

    /** Ordered view-module shapes that compose the pane. */
    abstract readonly slots: readonly AdminModuleSlot[];

    /**
     * The bridge component — wires the pane's ViewModel(s) to the slot
     * modules. Mounted by `AdminPageDispatch`.
     */
    abstract readonly Bridge: ComponentType;
}
