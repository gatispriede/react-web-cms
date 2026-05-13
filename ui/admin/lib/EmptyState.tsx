import React from 'react';
import {Button, Empty, Space, Typography} from 'antd';

/**
 * Shared admin empty-state surface.
 *
 * Replaces the bare `<Empty/>` / blank-table fallback every admin list
 * pane used to show. Each pane wires this in with a feature-specific
 * primary CTA and optional secondary link.
 *
 * Illustrations are intentionally placeholder iconography for the
 * AI-budget pass — the design spec calls for hand-drawn SVGs which is
 * wall-clock work (per `docs/roadmap/admin/admin-empty-states-onboarding.md`).
 * Until those land, callers can pass any `ReactNode` icon (typically a
 * large AntD outlined glyph) and the layout still reads cleanly.
 *
 * Project standards: ≤400 lines, predefined props (no free-text variant
 * strings), data-testid on every interactive surface.
 */
export interface EmptyStateAction {
    label: string;
    onClick: () => void;
    testId?: string;
    loading?: boolean;
    disabled?: boolean;
}

export interface EmptyStateProps {
    /** Stable id used for the root testid + nested action testids. */
    testId: string;
    /** Headline — semibold, ~18px via `Typography.Title level=4`. */
    title: string;
    /** One-paragraph context (~60ch max). Optional. */
    description?: string;
    /** Optional iconography placeholder (illustrations TBD per spec). */
    icon?: React.ReactNode;
    /** Primary CTA — omit for purely informational empty states (e.g. Audit). */
    primary?: EmptyStateAction;
    /** Optional secondary link / ghost action. */
    secondary?: EmptyStateAction;
}

const EmptyState: React.FC<EmptyStateProps> = ({testId, title, description, icon, primary, secondary}) => {
    const image = icon ?? Empty.PRESENTED_IMAGE_SIMPLE;
    return (
        <div
            data-testid={testId}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 24px',
                minHeight: 240,
                textAlign: 'center',
            }}
        >
            <Empty
                image={image}
                imageStyle={{height: 96, marginBottom: 16}}
                description={
                    <div style={{maxWidth: 480, margin: '0 auto'}}>
                        <Typography.Title level={4} style={{marginBottom: 8, marginTop: 0}}>
                            {title}
                        </Typography.Title>
                        {description ? (
                            <Typography.Paragraph type="secondary" style={{marginBottom: 0}}>
                                {description}
                            </Typography.Paragraph>
                        ) : null}
                    </div>
                }
            >
                {(primary || secondary) && (
                    <Space style={{marginTop: 16}}>
                        {primary && (
                            <Button
                                type="primary"
                                onClick={primary.onClick}
                                loading={primary.loading}
                                disabled={primary.disabled}
                                data-testid={primary.testId ?? `${testId}-primary`}
                            >
                                {primary.label}
                            </Button>
                        )}
                        {secondary && (
                            <Button
                                type="link"
                                onClick={secondary.onClick}
                                loading={secondary.loading}
                                disabled={secondary.disabled}
                                data-testid={secondary.testId ?? `${testId}-secondary`}
                            >
                                {secondary.label}
                            </Button>
                        )}
                    </Space>
                )}
            </Empty>
        </div>
    );
};

export default EmptyState;
