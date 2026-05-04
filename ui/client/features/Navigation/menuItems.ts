/**
 * Pure transform: page list (with optional `parent` ids) → AntD `<Menu>`
 * items array with nested `SubMenu`s. Extracted from the public top-bar nav
 * so it can be unit-tested without rendering AntD.
 *
 * Decision lock (docs/roadmap/sub-pages.md, decision 6): the public nav
 * primitive is `<Menu mode="horizontal">`. Root pages with children render
 * as `SubMenu`s; otherwise as flat `Menu.Item`s. Depth cap is 3 levels
 * (root + 2 child levels) — server enforces, this builder will accept any
 * depth but the design contract is 3.
 *
 * Slug chain rule: the menu key + URL fragment for a page is its full slug
 * chain joined by `/`. Top-level page `services` = key `services`, child
 * `cleaning` under it = key `services/cleaning`. The router turns that
 * into `/[locale]/services/cleaning` via the `[...slug]` catch-all.
 *
 * `selectedKeys` for the active route is computed by `activeKeysForPath`
 * — every ancestor of the current page is included so AntD highlights
 * the open SubMenu trigger as well as the leaf item.
 */

import {slugifyAnchor} from '@utils/stringFunctions';
import type {ReactNode} from 'react';

/** Minimal page shape this builder needs. Avoids coupling to the full
 *  `IPage` so callers can pass a projected list (e.g. from `INavigation`). */
export interface IMenuPage {
    /** Stable id used as `parent` reference. Falls back to `page` name when
     *  callers haven't materialised an id yet (legacy rows / tests). */
    id?: string;
    /** Display name. */
    page: string;
    /** Explicit slug if set; otherwise we slugify `page`. */
    slug?: string;
    /** Parent's `id` (or `page` when ids aren't around). Undefined = root. */
    parent?: string;
}

export interface IMenuBuilderOptions {
    /** Translator used for visible labels — keeps the registry walk pure
     *  while letting the menu show the user's locale. Defaults to identity
     *  so tests don't need an i18n harness. */
    translate?: (s: string) => string;
    /** Locale prefix to embed in the leaf `href` (`/lv/services/cleaning`).
     *  Empty string = no prefix (current single-segment routing). */
    locale?: string;
}

/** AntD Menu item shape — typed locally so this module doesn't import
 *  `antd` (keeps the unit test runtime tiny and prevents accidental
 *  client-only imports leaking into shared code). */
export interface IMenuNode {
    key: string;
    label: ReactNode;
    /** Resolvable href for the leaf item. SubMenus expose `href` too so
     *  callers can route on the parent itself when wanted. */
    href: string;
    children?: IMenuNode[];
}

/** Build a slug for one page in isolation (no chain). */
const pageSlug = (p: IMenuPage): string =>
    p.slug?.trim() || slugifyAnchor(p.page) || p.page;

/** Walk the slug chain up to the root, returning `[root, …, self]`. */
export const slugChainFor = (page: IMenuPage, all: IMenuPage[]): string[] => {
    const byKey = indexByParentKey(all);
    const chain: string[] = [];
    const seen = new Set<string>();
    let cur: IMenuPage | undefined = page;
    while (cur) {
        const key = cur.id ?? cur.page;
        if (seen.has(key)) break; // cycle guard — server prevents but be safe
        seen.add(key);
        chain.unshift(pageSlug(cur));
        if (!cur.parent) break;
        cur = byKey.get(cur.parent);
    }
    return chain;
};

/** Walk parent chain returning the page entries themselves (root → self). */
export const ancestorsFor = (page: IMenuPage, all: IMenuPage[]): IMenuPage[] => {
    const byKey = indexByParentKey(all);
    const out: IMenuPage[] = [];
    const seen = new Set<string>();
    let cur: IMenuPage | undefined = page;
    while (cur) {
        const key = cur.id ?? cur.page;
        if (seen.has(key)) break;
        seen.add(key);
        out.unshift(cur);
        if (!cur.parent) break;
        cur = byKey.get(cur.parent);
    }
    return out;
};

const indexByParentKey = (all: IMenuPage[]): Map<string, IMenuPage> => {
    const m = new Map<string, IMenuPage>();
    for (const p of all) m.set(p.id ?? p.page, p);
    return m;
};

/**
 * Build the AntD `Menu` items array. Order preserved from the input list
 * for top-level entries; children are emitted in input order beneath the
 * matching parent. Pages whose `parent` doesn't resolve to a loaded entry
 * (orphans) render as roots so they're still reachable.
 */
export const buildMenuItems = (
    pages: IMenuPage[],
    opts: IMenuBuilderOptions = {},
): IMenuNode[] => {
    const t = opts.translate ?? ((s: string) => s);
    const localePrefix = opts.locale ? `/${opts.locale}` : '';
    const byKey = indexByParentKey(pages);
    const childrenByParent = new Map<string, IMenuPage[]>();
    const roots: IMenuPage[] = [];

    for (const p of pages) {
        if (p.parent && byKey.has(p.parent)) {
            const list = childrenByParent.get(p.parent) ?? [];
            list.push(p);
            childrenByParent.set(p.parent, list);
        } else {
            roots.push(p);
        }
    }

    const buildNode = (p: IMenuPage, prefixChain: string[]): IMenuNode => {
        const chain = [...prefixChain, pageSlug(p)];
        const key = chain.join('/');
        const href = `${localePrefix}/${chain.join('/')}`;
        const kids = childrenByParent.get(p.id ?? p.page) ?? [];
        const node: IMenuNode = {key, href, label: t(p.page)};
        if (kids.length) {
            node.children = kids.map((c) => buildNode(c, chain));
        }
        return node;
    };

    return roots.map((r) => buildNode(r, []));
};

/**
 * Compute `selectedKeys` for the current route. Includes every ancestor
 * key so AntD highlights both the open SubMenu and the leaf.
 */
export const activeKeysForPath = (
    pages: IMenuPage[],
    currentSlugChain: string[],
): string[] => {
    if (currentSlugChain.length === 0) return [];
    // Find the page whose own slug-chain matches the longest prefix of the
    // current path. Walk every page once — n is small (tens, not thousands).
    let best: {chain: string[]; depth: number} | null = null;
    for (const p of pages) {
        const chain = slugChainFor(p, pages);
        if (chain.length > currentSlugChain.length) continue;
        const matches = chain.every((s, i) => s === currentSlugChain[i]);
        if (matches && (!best || chain.length > best.depth)) {
            best = {chain, depth: chain.length};
        }
    }
    if (!best) return [];
    // Emit one selectedKey per depth level — AntD keys SubMenus by their
    // own joined path, so `services` and `services/cleaning` both highlight.
    const keys: string[] = [];
    for (let i = 1; i <= best.chain.length; i++) {
        keys.push(best.chain.slice(0, i).join('/'));
    }
    return keys;
};
