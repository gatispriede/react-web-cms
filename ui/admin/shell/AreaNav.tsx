import React, {ReactNode} from 'react';
import {Menu} from 'antd';

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

    return (
        <Menu
            mode="vertical"
            data-testid={`nav-${area}-rail`}
            selectedKeys={active ? [active.path] : []}
            style={{minWidth: 200, borderInlineEnd: '1px solid rgba(0,0,0,0.06)'}}
            items={visible.map(it => ({
                key: it.path,
                icon: it.icon,
                label: (
                    <a
                        href={it.path}
                        data-testid={`nav-${area}-${it.testidSuffix}-link`}
                    >
                        {it.label}
                    </a>
                ),
            }))}
        />
    );
};

export default AreaNav;
