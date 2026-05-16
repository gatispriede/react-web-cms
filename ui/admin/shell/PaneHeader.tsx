import React from 'react';
import {Space, Typography} from 'antd';

/**
 * Shared admin pane header — `admin-information-architecture` jump.
 *
 * Every settings-shaped pane in the admin renders one of these at the
 * top instead of hand-rolling its own `<h2>` + actions row. Provides:
 *
 *   - `title`        — visible H2, semibold
 *   - `eyebrow`      — small uppercase area label above the title
 *                       (e.g. "Commerce", "System") so the operator's
 *                       breadcrumb is visible even if the sidebar is hidden
 *   - `description`  — optional one-line context under the title
 *   - `actions`      — right-aligned slot for primary / secondary buttons
 *   - `slot`         — escape hatch for non-standard headers (tabbed
 *                       surfaces, custom toolbars) — replaces the default
 *                       title/eyebrow stack while keeping the actions slot
 *
 * Rhythm: uses `--admin-rhythm-lg` (32px) for the header-to-content gap.
 * Every interactive element carries a stable testid so e2e + kbar can
 * target it without inspecting the DOM.
 *
 * ≤400 lines. data-testid on every surface (universal-requirement).
 */
export interface PaneHeaderProps {
    /** Stable id used for the root testid + nested testids. */
    testId: string;
    /** H2 string — translated by the caller. Required unless `slot` is set. */
    title?: string;
    /** Small uppercase area label above the title (e.g. "Commerce"). */
    eyebrow?: string;
    /** Optional one-line context under the title. */
    description?: string;
    /** Right-aligned actions slot — typically `<Space><Button.../></Space>`. */
    actions?: React.ReactNode;
    /** Replace the entire title/eyebrow/description stack with a custom node. */
    slot?: React.ReactNode;
}

const PaneHeader: React.FC<PaneHeaderProps> = ({testId, title, eyebrow, description, actions, slot}) => (
    <header
        data-testid={testId}
        style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--admin-rhythm-md, 16px)',
            paddingBottom: 'var(--admin-rhythm-md, 16px)',
            marginBottom: 'var(--admin-rhythm-lg, 32px)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        }}
    >
        <div style={{minWidth: 0, flex: 1}} data-testid={`${testId}-title-block`}>
            {slot ?? (
                <>
                    {eyebrow ? (
                        <Typography.Text
                            type="secondary"
                            data-testid={`${testId}-eyebrow`}
                            style={{
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                fontSize: 12,
                                display: 'block',
                                marginBottom: 'var(--admin-rhythm-xs, 4px)',
                            }}
                        >
                            {eyebrow}
                        </Typography.Text>
                    ) : null}
                    {title ? (
                        <Typography.Title
                            level={2}
                            data-testid={`${testId}-title`}
                            style={{margin: 0, fontSize: 22, fontWeight: 600}}
                        >
                            {title}
                        </Typography.Title>
                    ) : null}
                    {description ? (
                        <Typography.Paragraph
                            type="secondary"
                            data-testid={`${testId}-description`}
                            style={{margin: 0, marginTop: 'var(--admin-rhythm-xs, 4px)', maxWidth: 720}}
                        >
                            {description}
                        </Typography.Paragraph>
                    ) : null}
                </>
            )}
        </div>
        {actions ? (
            <Space data-testid={`${testId}-actions`} size="small" wrap>
                {actions}
            </Space>
        ) : null}
    </header>
);

export default PaneHeader;
