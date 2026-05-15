import React, {useMemo} from 'react';
import {Menu} from 'antd';
import type {MenuProps} from 'antd';
import Link from 'next/link';
import {
    activeKeysForPath,
    buildMenuItems,
    type IMenuNode,
    type IMenuPage,
} from './menuItems';

/**
 * Public top-bar nav primitive — AntD `<Menu mode="horizontal">` with
 * `SubMenu`s for nested pages. Replaces the hand-rolled tablist for
 * sub-page-aware sites; sites with only root pages render an identical
 * (visually & semantically) flat menu via the same component.
 *
 * Per-theme styling lives in each theme SCSS (`.nav-menu--{themeName}`),
 * not here — this file only renders structure.
 */
export interface IMainMenuProps {
    pages: IMenuPage[];
    /** Slug chain of the currently-open page (e.g. `['services','cleaning']`).
     *  Drives `selectedKeys` so AntD highlights the open SubMenu trigger
     *  AND the active leaf. */
    activeChain: string[];
    /** Theme slug from the active theme — Industrial / Studio / Paper /
     *  HighContrast (or any custom). Wraps the menu so per-theme SCSS
     *  rules can target it without leaking into other themes. */
    themeName?: string;
    /** Locale code (`lv`, `en` …) embedded in the leaf hrefs. Empty string
     *  for legacy single-segment routing. */
    locale?: string;
    /** Translator for visible labels — typically `next-i18next`'s `t`. */
    translate?: (s: string) => string;
    /** Flat menu entries appended after the page tree. Used for routes that
     *  aren't `INavigation` rows (e.g. `/blog`). Keep `key` unique against
     *  page slugs. Empty/undefined when the caller has nothing to append. */
    extraItems?: IMenuNode[];
}

const toAntdItems = (nodes: IMenuNode[]): NonNullable<MenuProps['items']> =>
    nodes.map((n) => {
        // SubMenu trigger and leaf both wrap the label in a Link so clicking
        // the parent's name navigates to the parent page (AntD's hover/click
        // open logic still fires). The `data-testid` rides on the Link, not
        // the AntD `items` entry — AntD doesn't forward arbitrary attributes
        // on menu items, but it renders the label node verbatim. Per-mode
        // href assertion (`/${slug}` in tabs mode vs `#${anchor}` in scroll
        // mode) targets `main-menu-link-{key}`. F6 site-mode-toggle.
        const labelEl = (
            <Link
                href={n.href}
                className="navigation-item"
                data-testid={`main-menu-link-${n.key}`}
            >
                {n.label}
            </Link>
        );
        return {
            key: n.key,
            label: labelEl,
            children: n.children?.length ? toAntdItems(n.children) : undefined,
        };
    });

export const MainMenu: React.FC<IMainMenuProps> = ({
    pages,
    activeChain,
    themeName,
    locale,
    translate,
    extraItems,
}) => {
    // Memoize: pages array identity changes on every parent re-render but
    // its content is stable across navigation events. Extra (non-page-tree)
    // routes append after the tree so they sit on the right of the page
    // links — matches the legacy "Blog at the end of the nav" placement.
    const items = useMemo(
        () => {
            const tree = toAntdItems(buildMenuItems(pages, {locale, translate}));
            return extraItems?.length
                ? [...tree, ...toAntdItems(extraItems)]
                : tree;
        },
        [pages, locale, translate, extraItems],
    );
    const selectedKeys = useMemo(
        () => activeKeysForPath(pages, activeChain),
        [pages, activeChain],
    );

    const className = themeName
        ? `nav-menu nav-menu--${themeName}`
        : 'nav-menu';

    return (
        <Menu
            mode="horizontal"
            className={className}
            items={items}
            selectedKeys={selectedKeys}
            // Active-trail highlight on the SubMenu trigger — without this,
            // the parent label only goes "selected" on click, not when one
            // of its children is the current route.
            triggerSubMenuAction="hover"
            disabledOverflow
        />
    );
};

export default MainMenu;
