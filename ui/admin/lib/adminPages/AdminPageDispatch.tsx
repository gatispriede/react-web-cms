/**
 * admin-module-composed — `AdminPageDispatch`.
 *
 * Admin-side analogue of the customer `SystemPageDispatch`. Given a
 * pane id, resolves the registered `AdminLoader` and renders its
 * bridge. A migrated `*AdminUILoader.ts` points its
 * `adminPane.modes.advanced` at `<AdminPageDispatch paneId="…"/>`, so
 * the shell's existing route dispatch (`renderPane()` in
 * `UserStatusBar`) is untouched.
 */
import React from 'react';
import {adminPageRegistry} from './AdminPageRegistry';

export interface AdminPageDispatchProps {
    /** Matches the `AdminPaneDescriptor.id` + the bridge's `AdminLoader.paneId`. */
    paneId: string;
}

export const AdminPageDispatch: React.FC<AdminPageDispatchProps> = ({paneId}) => {
    const loader = adminPageRegistry.get(paneId);
    if (!loader) {
        return (
            <div data-testid="admin-page-dispatch-missing" style={{padding: 24}}>
                No admin page registered for <code>{paneId}</code>.
            </div>
        );
    }
    const {Bridge} = loader;
    return (
        <div className="admin-page-dispatch" data-testid="admin-page-dispatch" data-pane-id={paneId}>
            <Bridge/>
        </div>
    );
};

export default AdminPageDispatch;
