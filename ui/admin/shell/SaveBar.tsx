import React from 'react';
import {Button, Space, Typography} from 'antd';

/**
 * Shared admin SaveBar — `admin-information-architecture` jump.
 *
 * Sticks to the bottom of pane content; visible only when the pane is
 * dirty. Replaces the inline "Save / Revert" rows every pane has rolled
 * by hand. Confirmation toasts are the caller's responsibility (use
 * Sonner via `@admin/lib/notify`); SaveBar only owns the row chrome +
 * dirty-state visibility.
 *
 * Rhythm: top margin = `--admin-rhythm-lg` (32px) between content and
 * the bar; internal gap = `--admin-rhythm-sm` (8px).
 *
 * ≤400 lines. data-testid on every surface (universal-requirement).
 */
export interface SaveBarProps {
    /** Stable id used for the root testid + nested testids. */
    testId: string;
    /** When false the bar collapses to nothing (no dirty-state, no chrome). */
    dirty: boolean;
    /** Save in flight — disables the buttons and shows a spinner on save. */
    busy?: boolean;
    /** Primary save handler. Required. */
    onSave: () => void | Promise<void>;
    /** Optional revert handler — shown as a ghost button left of Save. */
    onRevert?: () => void;
    /** Optional override for the save label (defaults to "Save"). */
    saveLabel?: string;
    /** Optional override for the revert label (defaults to "Revert"). */
    revertLabel?: string;
    /** Optional helper line on the left (e.g. "Unsaved changes."). */
    hint?: string;
}

const SaveBar: React.FC<SaveBarProps> = ({
    testId,
    dirty,
    busy = false,
    onSave,
    onRevert,
    saveLabel = 'Save',
    revertLabel = 'Revert',
    hint = 'Unsaved changes.',
}) => {
    if (!dirty) return null;
    return (
        <div
            data-testid={testId}
            role="region"
            aria-label="Unsaved changes"
            style={{
                position: 'sticky',
                bottom: 0,
                marginTop: 'var(--admin-rhythm-lg, 32px)',
                paddingTop: 'var(--admin-rhythm-sm, 8px)',
                paddingBottom: 'var(--admin-rhythm-sm, 8px)',
                paddingLeft: 'var(--admin-rhythm-md, 16px)',
                paddingRight: 'var(--admin-rhythm-md, 16px)',
                borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                background: 'var(--admin-savebar-bg, rgba(255, 255, 255, 0.96))',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--admin-rhythm-md, 16px)',
                zIndex: 5,
            }}
        >
            <Typography.Text type="secondary" data-testid={`${testId}-hint`}>
                {hint}
            </Typography.Text>
            <Space size="small">
                {onRevert ? (
                    <Button
                        onClick={onRevert}
                        disabled={busy}
                        data-testid={`${testId}-revert`}
                    >
                        {revertLabel}
                    </Button>
                ) : null}
                <Button
                    type="primary"
                    onClick={() => { void onSave(); }}
                    loading={busy}
                    data-testid={`${testId}-save`}
                >
                    {saveLabel}
                </Button>
            </Space>
        </div>
    );
};

export default SaveBar;
