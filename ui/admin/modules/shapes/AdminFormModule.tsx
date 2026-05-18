/**
 * admin-module-composed — `AdminForm` view shape.
 *
 * Generic single-doc form surface: a titled chrome with an optional
 * audit badge / header-extra slot, the form body in `children` (the
 * bridge owns the bespoke AntD `<Form>`), an error banner, and a
 * save row. Pure view capacity — the bridge keeps its ViewModel +
 * service calls; only the chrome moves into the module.
 *
 * admin-information-architecture follow-up (2026-05-16): the AntD
 * `<Card>` chrome was replaced with the shared `<PaneHeader>` so
 * every settings-shaped pane uses one consistent header. The bridge's
 * `title` / `headerExtra` props feed the title block + actions slot;
 * `eyebrow` / `description` are new optional inputs. The save row
 * stays as-is for this jump — promoting it to the shared `<SaveBar>`
 * needs per-VM `dirty` state which is feature work, separate jump.
 */
import React from 'react';
import {Button, Space, Typography} from 'antd';
import PaneHeader from '@admin/shell/PaneHeader';

export interface AdminFormModuleProps {
    testId: string;
    title: string;
    /** Small uppercase area label above the title — feeds the shared
     *  `<PaneHeader>` eyebrow (e.g. "Settings", "System"). */
    eyebrow?: string;
    /** Optional one-line context under the title. */
    description?: string;
    /** Header-right slot — typically an `<AuditBadge/>`. */
    headerExtra?: React.ReactNode;
    /** Override the testid used on the shared `<PaneHeader>` root.
     *  Defaults to `${testId}-header`. */
    paneHeaderTestId?: string;
    /** Surface-level error banner. */
    error?: string | null;
    /** The form body — the bridge's bespoke `<Form>…</Form>`. */
    children: React.ReactNode;
    /** Save action. When omitted, the save bar is hidden (read-only form). */
    onSave?: () => void;
    saveLabel?: string;
    saveTestId?: string;
    saving?: boolean;
    /** Disable the save button (e.g. pristine form). */
    saveDisabled?: boolean;
    /** Optional secondary actions rendered next to Save (Reset, Cancel…). */
    footerExtra?: React.ReactNode;
}

const AdminFormModule: React.FC<AdminFormModuleProps> = ({
    testId,
    title,
    eyebrow,
    description,
    headerExtra,
    paneHeaderTestId,
    error,
    children,
    onSave,
    saveLabel = 'Save',
    saveTestId,
    saving,
    saveDisabled,
    footerExtra,
}) => {
    return (
        <div data-testid={testId} style={{padding: 16}}>
            <PaneHeader
                testId={paneHeaderTestId ?? `${testId}-header`}
                title={title}
                eyebrow={eyebrow}
                description={description}
                actions={headerExtra}
            />
            {error && (
                <Typography.Text type="danger" data-testid={`${testId}-error`}>{error}</Typography.Text>
            )}
            {children}
            {onSave && (
                <Space style={{marginTop: 16}}>
                    <Button
                        data-testid={saveTestId}
                        type="primary"
                        onClick={onSave}
                        loading={saving}
                        disabled={saveDisabled}
                    >{saveLabel}</Button>
                    {footerExtra}
                </Space>
            )}
        </div>
    );
};

export default AdminFormModule;
export {AdminFormModule};
