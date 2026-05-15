import React from 'react';
import {Button, Space, Typography} from 'antd';
import {emptyStateArt, type EmptyStateArtKey} from '@admin/lib/emptyStateArt';

/**
 * Shared admin empty-state surface — operator-grade.
 *
 * Replaces the bare `<Empty/>` / blank-table fallback every admin list
 * pane used to show. Each pane wires this in with a feature-specific
 * primary CTA, an optional secondary link, and an `art` key that selects
 * a designed inline-SVG illustration from `ui/admin/lib/emptyStateArt/`.
 *
 * The illustration set (`emptyStateArt/index.tsx`) is keyed per surface
 * (`pages`, `posts`, `products`, …) — callers pass the `art` key rather
 * than a raw node, so the look stays consistent across panes and tracks
 * light/dark mode via `currentColor`. `icon` remains an escape hatch for
 * a one-off node (a big AntD glyph, say); when both are set `icon` wins.
 *
 * Onboarding tie-in: `onboardingCta()` builds a ready-made secondary
 * action that deep-links into the first-run wizard, so an empty pane can
 * always route a stuck operator back to guided setup. Panes that have a
 * more specific destination (a create flow, a warehouse-connect screen)
 * pass their own `secondary` instead.
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
    /** Designed illustration key — resolved from `emptyStateArt`. */
    art?: EmptyStateArtKey;
    /** One-off illustration node. Overrides `art` when both are set. */
    icon?: React.ReactNode;
    /** Primary CTA — omit for purely informational empty states (e.g. Audit). */
    primary?: EmptyStateAction;
    /** Optional secondary link / ghost action. */
    secondary?: EmptyStateAction;
}

/**
 * Deep-link an empty pane back into the first-run onboarding wizard.
 *
 * Returns an `EmptyStateAction` a pane can hand straight to `secondary`.
 * Navigates via `window.location.assign` rather than the admin pane
 * registry because the wizard is a standalone route, not a registered
 * pane the in-app router can swap to. `force=1` re-runs the wizard for
 * an already-bootstrapped install (it never wipes existing content —
 * only the opt-in seed step adds anything).
 */
export function onboardingCta(label: string, testId?: string): EmptyStateAction {
    return {
        label,
        testId,
        onClick: () => {
            if (typeof window !== 'undefined') {
                window.location.assign('/admin/onboarding?force=1');
            }
        },
    };
}

const EmptyState: React.FC<EmptyStateProps> = ({testId, title, description, art, icon, primary, secondary}) => {
    const illustration = icon ?? emptyStateArt(art);
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
            <div data-testid={`${testId}-illustration`} style={{marginBottom: 16, lineHeight: 0}}>
                {illustration}
            </div>
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
        </div>
    );
};

export default EmptyState;
