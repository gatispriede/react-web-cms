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
}

const toAntdItems = (nodes: IMenuNode[]): NonNullable<MenuProps['items']> =>
    nodes.map((n) => {
        const labelEl = n.children?.length
            // SubMenu trigger: clicking the parent's name should also navigate
            // to the parent page, so wrap in a Link. AntD's hover/click open
            // logic still fires on the parent label.
            ? <Link href={n.href} className="navigation-item">{n.label}</Link>
            : <Link href={n.href} className="navigation-item">{n.label}</Link>;
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
}) => {
    // Memoize: pages array identity changes on every parent re-render but
    // its content is stable across navigation events.
    const items = useMemo(
        () => toAntdItems(buildMenuItems(pages, {locale, translate})),
        [pages, locale, translate],
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
