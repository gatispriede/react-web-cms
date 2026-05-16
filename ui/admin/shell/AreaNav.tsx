import React, {ReactNode} from 'react';
import {Menu, Tooltip} from 'antd';
import {useIsMobile} from '@admin/lib/useIsMobile';

/**
 * Phase 2 of admin segregation (docs/features/platform/admin-segregation.md).
 *
 * Vertical rail listing the sub-pages of an area. Renders to the left of
 * the area's main pane. Each item is a real link (`href`) — clicking
 * navigates (real route change), not a state toggle. The current sub-page
 * is highlighted via `selectedKeys`.
 *
 * `area` is the URL prefix (`release`, `content`, …); each item's `path`
 * is the full sub-page URL (e.g. `/admin/release/bundle`). The active item
 * is detected by string-matching `currentPath` against `path`.
 */
export type AreaNavItem = {
    /** Full URL of the sub-page (e.g. `/admin/release/bundle`). */
    path: string;
    /** Visible label. Already translated by the caller. */
    label: string;
    /** Optional leading icon. */
    icon?: ReactNode;
    /** Stable testid suffix (e.g. `bundle`). Composed into `nav-<area>-<suffix>-link`. */
    testidSuffix: string;
    /** When true, hidden unless the viewer is an admin. */
    adminOnly?: boolean;
    /**
     * Plain-English one-line description, shown as a hover tooltip on the
     * rail item. Translated by the caller. Operators who don't know what
     * "SEO defaults" or "Bundle" means get a clear hint without leaving
     * the rail. Optional — items without a description render no tooltip.
     */
    description?: string;
};

const AreaNav = ({
    area,
    items,
    currentPath,
    isAdmin,
}: {
    area: string;
    items: AreaNavItem[];
    currentPath: string;
    isAdmin: boolean;
}) => {
    const visible = items.filter(it => !it.adminOnly || isAdmin);
    // DECISION: pick the longest matching path as the active key — covers
    // both the area landing (`/admin/release`) and a sub-page
    // (`/admin/release/bundle`) without false-matching the landing as
    // active when a sub-page is open.
    const active = visible
        .filter(it => currentPath === it.path || currentPath.startsWith(it.path + '/'))
        .sort((a, b) => b.path.length - a.path.length)[0];

    // Mobile flips the rail to AntD's native `mode="horizontal"` instead
    // of trying to coax a vertical Menu into a horizontal scroll strip
    // via CSS (the operator screenshot 2026-05-08 caught the failure mode:
    // selected item rendered as an empty blue tile because vertical-mode
    // markup carries a different label-wrapper structure than horizontal).
    // AntD owns the horizontal layout; we just hand it the right mode.
    const isMobile = useIsMobile();
    const mode = isMobile ? 'horizontal' : 'vertical';

    return (
        <Menu
            mode={mode}
            data-testid={`nav-${area}-rail`}
            selectedKeys={active ? [active.path] : []}
            style={isMobile ? undefined : {minWidth: 200, borderInlineEnd: '1px solid rgba(0,0,0,0.06)'}}
            items={visible.map(it => {
                const link = (
                    <a
                        href={it.path}
                        data-testid={`nav-${area}-${it.testidSuffix}-link`}
                    >
                        {it.label}
                    </a>
                );
                return {
                    key: it.path,
                    icon: it.icon,
                    // DECISION: tooltip wraps only the label anchor — keeping
                    // the icon outside the trigger means hover-targets feel
                    // the same with/without a description. Tooltip placement
                    // is `right` on the desktop vertical rail so it floats
                    // out into the pane rather than overlapping the rail
                    // itself; horizontal (mobile) gets `bottom`.
                    label: it.description ? (
                        <Tooltip
                            title={it.description}
                            placement={isMobile ? 'bottom' : 'right'}
                            mouseEnterDelay={0.4}
                        >
                            {link}
                        </Tooltip>
                    ) : link,
                };
            })}
        />
    );
};

export default AreaNav;
