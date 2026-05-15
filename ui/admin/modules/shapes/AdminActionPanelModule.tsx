/**
 * admin-module-composed — `AdminActionPanel` view shape.
 *
 * Generic import/export-style action surface: a titled Card with an
 * intro blurb, the action controls in `children` (file drop / picker /
 * buttons — the bridge owns those), and an optional result-summary
 * slot. Pure view capacity.
 */
import React from 'react';
import {Card, Typography} from 'antd';

export interface AdminActionPanelModuleProps {
    testId: string;
    title: string;
    /** One-line description of what the panel does. */
    description?: React.ReactNode;
    /** Header-right slot. */
    headerExtra?: React.ReactNode;
    /** The action controls — file drop / picker / action buttons. */
    children: React.ReactNode;
    /** Result summary rendered below the controls once an action ran. */
    result?: React.ReactNode;
    /** Surface-level error banner. */
    error?: string | null;
}

const AdminActionPanelModule: React.FC<AdminActionPanelModuleProps> = ({
    testId,
    title,
    description,
    headerExtra,
    children,
    result,
    error,
}) => {
    return (
        <div data-testid={testId} style={{padding: 16}}>
            <Card title={title} extra={headerExtra}>
                {description && (
                    <Typography.Paragraph type="secondary" style={{marginBottom: 16}}>
                        {description}
                    </Typography.Paragraph>
                )}
                {error && (
                    <Typography.Text type="danger" data-testid={`${testId}-error`}>{error}</Typography.Text>
                )}
                <div data-testid={`${testId}-controls`}>{children}</div>
                {result && (
                    <div data-testid={`${testId}-result`} style={{marginTop: 16}}>{result}</div>
                )}
            </Card>
        </div>
    );
};

export default AdminActionPanelModule;
export {AdminActionPanelModule};
