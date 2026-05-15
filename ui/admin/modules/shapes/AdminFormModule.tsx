/**
 * admin-module-composed — `AdminForm` view shape.
 *
 * Generic single-doc form surface: a titled Card with an optional
 * audit badge / header-extra slot, the form body in `children` (the
 * bridge owns the bespoke AntD `<Form>`), an error banner, and a
 * sticky save bar. Pure view capacity — the bridge keeps its
 * ViewModel + service calls; only the chrome moves into the module.
 */
import React from 'react';
import {Button, Card, Space, Typography} from 'antd';

export interface AdminFormModuleProps {
    testId: string;
    title: string;
    /** Header-right slot — typically an `<AuditBadge/>`. */
    headerExtra?: React.ReactNode;
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
    headerExtra,
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
            <Card title={title} extra={headerExtra}>
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
            </Card>
        </div>
    );
};

export default AdminFormModule;
export {AdminFormModule};
