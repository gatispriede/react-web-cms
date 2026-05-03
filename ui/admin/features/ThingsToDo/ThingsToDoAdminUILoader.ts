import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import ThingsToDoPanel from './ThingsToDoPanel';

/**
 * Things-to-do admin pane — the simplified-only home for `/admin`.
 *
 * Mounting strategy (per `admin-ui-modes.md`): in simplified mode the
 * top-level admin route surfaces *what needs doing* instead of a
 * sidebar full of feature panes. The pane only declares a `simplified`
 * mode component; in advanced mode the existing dashboard/route
 * fallback continues to handle `/admin`. The AdminShell mode picker
 * skips this descriptor when the user is in advanced mode and the pane
 * has no `advanced` component to render.
 *
 * Route choice: `/admin/build` was considered as a "simplified pane
 * fallback" home, but the more useful spot is the bare `/admin` root
 * — that's where a simplified user lands first, and it's where they
 * benefit most from a list of pending tasks. Advanced users see the
 * standard dashboard at the same URL via the legacy switch.
 */
export class ThingsToDoAdminUILoader extends AdminUILoader {
    readonly id = 'things-to-do';
    readonly displayName = 'Things to do';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'home/things-to-do',
        title: 'Things to do',
        route: '/admin',
        modes: {
            // Advanced mode falls through to the legacy dashboard. We
            // still need to satisfy the `advanced` field requirement on
            // AdminPaneDescriptor; reuse the same component as a safe
            // default rather than gating on `null` in the shell.
            simplified: ThingsToDoPanel,
            advanced: ThingsToDoPanel,
        },
    };
}
