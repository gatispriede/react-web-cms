import React from 'react';
import Link from 'next/link';
import {Breadcrumb as AntBreadcrumb} from 'antd';
import {INavigation} from '@interfaces/INavigation';
import {slugifyAnchor} from '@utils/stringFunctions';

/** Pick a plain-string slug from a `string | Record<LocaleCode, string>`
 *  shape. Per-locale slugs (F1 follow-up) widened the field; this helper
 *  collapses to a single segment for the breadcrumb's URL composition.
 *  Empty / missing → falls through to slugifyAnchor(page). Mirrors the
 *  resolver's fallback rules but keeps Breadcrumb dependency-free of the
 *  server-side `resolveSlug`. */
function slugSegment(p: Pick<INavigation, 'slug' | 'page'>): string {
    const s = p.slug as unknown;
    if (typeof s === 'string' && s.length > 0) return s;
    if (s && typeof s === 'object' && !Array.isArray(s)) {
        const map = s as Record<string, string>;
        const any = Object.values(map).find(v => typeof v === 'string' && v.length > 0);
        if (any) return any;
    }
    return slugifyAnchor(p.page) || p.page;
}

/**
 * F1 sub-pages — public-side breadcrumb. Walks the parent chain from
 * the current page up to root and renders `Home › Services › Cleaning`.
 * Each segment is a `<Link>` so visitors can jump up the tree.
 *
 * Hidden by the caller when the current page is a root (no parent) —
 * we still render `null` here defensively for the same case.
 */

interface IProps {
    /** All known navigation rows (used to walk the parent chain). */
    pages: INavigation[];
    /** The page being rendered. Walks up its `parent` chain. */
    current: INavigation;
    /** Path prefix for hrefs — usually `/${lang}`. */
    pathPrefix?: string;
    /** Label for the root crumb. Defaults to "Home". */
    homeLabel?: string;
}

/** Pure helper — assemble crumbs from current up to root, in
 *  display order (root first). Exported for unit tests. */
export function buildCrumbs(pages: INavigation[], current: INavigation): INavigation[] {
    const byId = new Map(pages.map(p => [p.id, p] as const));
    const chain: INavigation[] = [current];
    const seen = new Set<string>([current.id]);
    let cur: INavigation | undefined = current;
    while (cur?.parent && byId.has(cur.parent) && !seen.has(cur.parent)) {
        seen.add(cur.parent);
        cur = byId.get(cur.parent);
        if (cur) chain.unshift(cur);
    }
    return chain;
}

function pageHref(pages: INavigation[], page: INavigation, prefix: string): string {
    // Walk parents to assemble the slug chain. Falls back to `page` (the
    // display name) when `slug` is missing — pre-F1 rows don't have one
    // until the next save round-trips through `addUpdateNavigationItem`.
    const byId = new Map(pages.map(p => [p.id, p] as const));
    const parts: string[] = [];
    let cur: INavigation | undefined = page;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        parts.unshift(slugSegment(cur));
        cur = cur.parent ? byId.get(cur.parent) : undefined;
    }
    return `${prefix}/${parts.join('/')}`;
}

const Breadcrumb: React.FC<IProps> = ({pages, current, pathPrefix = '', homeLabel = 'Home'}) => {
    if (!current.parent) return null;
    const crumbs = buildCrumbs(pages, current);
    const items = [
        {title: <Link href={pathPrefix || '/'}>{homeLabel}</Link>},
        ...crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return {
                title: isLast
                    ? <span>{c.page}</span>
                    : <Link href={pageHref(pages, c, pathPrefix)}>{c.page}</Link>,
            };
        }),
    ];
    return <AntBreadcrumb separator="›" items={items} data-testid="page-breadcrumb"/>;
};

export default Breadcrumb;
