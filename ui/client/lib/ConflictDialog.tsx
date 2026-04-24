import React from 'react';
import {Alert, Modal, Space, Typography} from 'antd';

/**
 * Reusable optimistic-concurrency conflict dialog. Each editor surface that
 * makes versioned writes catches `ConflictError` from `src/frontend/lib/conflict.ts`
 * and renders one of these — passing handlers for the two recoverable choices:
 *
 *   • "Take theirs" — discard the local draft, reload from the server and
 *     show the peer's changes. Caller refetches and resets local state.
 *   • "Keep mine"  — overwrite with the local draft, accepting the server's
 *     newer `version` as the new baseline. Caller resaves the same payload
 *     with `expectedVersion = err.currentVersion`.
 *
 * "Merge" (cherry-pick fields from each side) is intentionally deferred —
 * see `roadmap/multi-admin-conflict-mitigation.md` Phase 2 / Layer 2 notes.
 */
const ConflictDialog: React.FC<{
    open: boolean;
    docKind: string;
    /** Email / id of the peer whose write created the conflict, when known. */
    peerEditedBy?: string;
    peerEditedAt?: string;
    /** Server's current `version` after the peer's write — what the next
     *  local save must use as `expectedVersion` to succeed. */
    peerVersion: number;
    onTakeTheirs: () => void;
    onKeepMine: () => void;
    onCancel: () => void;
    keepMineDisabled?: boolean;
    takeTheirsLabel?: string;
    keepMineLabel?: string;
}> = ({
    open,
    docKind,
    peerEditedBy,
    peerEditedAt,
    peerVersion,
    onTakeTheirs,
    onKeepMine,
    onCancel,
    keepMineDisabled = false,
    takeTheirsLabel = 'Take theirs (reload)',
    keepMineLabel = 'Keep mine (overwrite)',
}) => {
    const editedAtPretty = peerEditedAt ? new Date(peerEditedAt).toLocaleString() : undefined;
    return (
        <Modal
            open={open}
            title={`${docKind} — conflict`}
            onCancel={onCancel}
            footer={[
                <button key="take" type="button" onClick={onTakeTheirs} className="ant-btn ant-btn-default" style={{marginRight: 8}}>
                    {takeTheirsLabel}
                </button>,
                <button key="keep" type="button" onClick={onKeepMine} disabled={keepMineDisabled} className="ant-btn ant-btn-primary" style={{opacity: keepMineDisabled ? 0.5 : 1}}>
                    {keepMineLabel}
                </button>,
            ]}
            width={520}
        >
            <Space direction="vertical" size={12} style={{width: '100%'}}>
                <Alert
                    type="warning"
                    showIcon
                    message="Someone else saved this since you opened it."
                    description={
                        <span>
                            {peerEditedBy ? <><strong>{peerEditedBy}</strong> </> : null}
                            saved version <Typography.Text code>{peerVersion}</Typography.Text>
                            {editedAtPretty ? <> at {editedAtPretty}</> : null}.
                        </span>
                    }
                />
                <Typography.Paragraph type="secondary" style={{marginBottom: 0}}>
                    Choose how to resolve:
                </Typography.Paragraph>
                <ul style={{margin: 0, paddingLeft: 18, color: '#555'}}>
                    <li><strong>Take theirs</strong> — discards your unsaved changes and reloads the server&rsquo;s version.</li>
                    <li><strong>Keep mine</strong> — overwrites the server with your draft. The peer&rsquo;s edits will be lost.</li>
                </ul>
            </Space>
        </Modal>
    );
};

export default ConflictDialog;
