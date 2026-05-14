/**
 * admin-module-composed — `AdminConflict` view shape.
 *
 * Generic optimistic-locking conflict surface. Thin wrapper over the
 * existing `ConflictDialog` so panes compose a registered module shape
 * instead of inlining the dialog ad-hoc. Pure view capacity — the
 * bridge keeps the take-mine / take-theirs / retry logic in its
 * ViewModel and passes the handlers in.
 */
import React from 'react';
import ConflictDialog from '@client/lib/ConflictDialog';

export interface AdminConflictModuleProps {
    /** When false the dialog is unmounted — the bridge drives this off
     *  its `vm.conflict` state. */
    open: boolean;
    /** Human label for the document kind ("Product", "Page", …). */
    docKind: string;
    peerVersion?: number;
    peerEditedBy?: string;
    peerEditedAt?: string;
    /** Discard the local edit, take the peer's version. */
    onTakeTheirs: () => void;
    /** Re-attempt the save against the peer's version. */
    onKeepMine: () => void;
    /** Dismiss without resolving. */
    onCancel: () => void;
}

const AdminConflictModule: React.FC<AdminConflictModuleProps> = ({
    open,
    docKind,
    peerVersion,
    peerEditedBy,
    peerEditedAt,
    onTakeTheirs,
    onKeepMine,
    onCancel,
}) => {
    if (!open) return null;
    return (
        <ConflictDialog
            open
            docKind={docKind}
            peerVersion={peerVersion}
            peerEditedBy={peerEditedBy}
            peerEditedAt={peerEditedAt}
            onCancel={onCancel}
            onTakeTheirs={onTakeTheirs}
            onKeepMine={onKeepMine}
        />
    );
};

export default AdminConflictModule;
export {AdminConflictModule};
