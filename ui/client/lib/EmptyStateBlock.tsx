import React from 'react';
import './EmptyStateBlock.scss';

/**
 * Public-side empty-state primitive — sibling of `ui/admin/lib/EmptyState.tsx`.
 *
 * Used by storefront modules + features when a list is empty:
 *  - "No results match your filters" on `/cars` / `/products`
 *  - "Nothing in your wishlist yet"
 *  - "No saved searches"
 *  - "We couldn't find this car (it may have been sold)"
 *
 * Theme-driven via CSS custom properties — no AntD. Reads --background,
 * --ink, --accent, --font-display, --theme-borderRadius from the active
 * theme. Honours `--motion-scalar` for the icon-fade animation.
 *
 * Same prop shape as the admin EmptyState (testId + title + description
 * + icon + primary + secondary) so call sites can share the action
 * helper type. Different visual treatment — illustrations sit on a
 * theme-tinted surface and the action row uses theme buttons.
 */

export interface EmptyStateBlockAction {
    label: string;
    onClick?: () => void;
    href?: string;
    testId?: string;
    disabled?: boolean;
}

export interface EmptyStateBlockProps {
    /** Stable id used for the root testid + nested action testids. */
    testId: string;
    /** Headline. */
    title: string;
    /** One-paragraph context (~60ch max). Optional. */
    description?: string;
    /** Optional iconography — caller supplies any ReactNode (theme-driven SVG,
     *  emoji, lucide icon — all valid). */
    icon?: React.ReactNode;
    /** Primary CTA — when `href` is set the component renders an `<a>`,
     *  otherwise a `<button>`. */
    primary?: EmptyStateBlockAction;
    /** Optional secondary link / ghost action. */
    secondary?: EmptyStateBlockAction;
}

function ActionEl({action, fallbackTestId, kind}: {
    action: EmptyStateBlockAction;
    fallbackTestId: string;
    kind: 'primary' | 'secondary';
}): React.ReactElement {
    const testid = action.testId ?? fallbackTestId;
    const cls = `empty-state-block__action empty-state-block__action--${kind}`;
    if (action.href) {
        return (
            <a
                className={cls}
                href={action.href}
                data-testid={testid}
                aria-disabled={action.disabled || undefined}
                onClick={e => { if (action.disabled) e.preventDefault(); }}
            >{action.label}</a>
        );
    }
    return (
        <button
            type="button"
            className={cls}
            data-testid={testid}
            disabled={action.disabled}
            onClick={action.onClick}
        >{action.label}</button>
    );
}

const EmptyStateBlock: React.FC<EmptyStateBlockProps> = ({testId, title, description, icon, primary, secondary}) => {
    return (
        <div className="empty-state-block" data-testid={testId} role="status">
            {icon ? (
                <div className="empty-state-block__icon" aria-hidden data-testid={`${testId}-icon`}>{icon}</div>
            ) : null}
            <h3 className="empty-state-block__title" data-testid={`${testId}-title`}>{title}</h3>
            {description ? (
                <p className="empty-state-block__description" data-testid={`${testId}-description`}>{description}</p>
            ) : null}
            {(primary || secondary) && (
                <div className="empty-state-block__actions">
                    {primary && <ActionEl action={primary} fallbackTestId={`${testId}-primary`} kind="primary" />}
                    {secondary && <ActionEl action={secondary} fallbackTestId={`${testId}-secondary`} kind="secondary" />}
                </div>
            )}
        </div>
    );
};

export default EmptyStateBlock;
export {EmptyStateBlock};
