/**
 * admin-module-composed — `AdminPreview` view shape.
 *
 * Generic embedded-preview surface: a titled Card with a controls row
 * (theme picker / viewport toggle / sample selector — the bridge owns
 * those) above the preview slot in `children` (an iframe, a rendered
 * module sample, a template render). Pure view capacity.
 */
import React from 'react';
import {Card, Space} from 'antd';

export interface AdminPreviewModuleProps {
    testId: string;
    title?: string;
    /** Controls row — theme picker, viewport toggle, sample selector. */
    controls?: React.ReactNode;
    /** Header-right slot. */
    headerExtra?: React.ReactNode;
    /** The preview body — iframe / rendered sample / template render. */
    children: React.ReactNode;
    /** Optional explicit viewport width for the preview frame (px). */
    viewportWidth?: number;
}

const AdminPreviewModule: React.FC<AdminPreviewModuleProps> = ({
    testId,
    title,
    controls,
    headerExtra,
    children,
    viewportWidth,
}) => {
    return (
        <div data-testid={testId} style={{padding: 16}}>
            <Card title={title} extra={headerExtra}>
                {controls && (
                    <Space wrap data-testid={`${testId}-controls`} style={{marginBottom: 16}}>
                        {controls}
                    </Space>
                )}
                <div
                    data-testid={`${testId}-frame`}
                    style={{
                        width: viewportWidth ? `${viewportWidth}px` : '100%',
                        maxWidth: '100%',
                        margin: viewportWidth ? '0 auto' : undefined,
                        border: '1px solid #eee',
                        borderRadius: 8,
                        overflow: 'hidden',
                    }}
                >
                    {children}
                </div>
            </Card>
        </div>
    );
};

export default AdminPreviewModule;
export {AdminPreviewModule};
