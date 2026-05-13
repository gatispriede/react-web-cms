import React from "react";
import Link from "next/link";
import {buildFooterColumns, IFooterColumn, IFooterConfig} from "@interfaces/IFooter";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import AccountLinks from "@client/components/Auth/AccountLinks";

interface Props {
    config: IFooterConfig;
    pages: {page: string}[];
    hasPosts: boolean;
    blogEnabled?: boolean;
    t?: (s: string) => string;
    /** When 'scroll', any entry whose URL matches a page route gets
     *  rewritten to `#<slug>` so footer nav stays inside the single
     *  scroll-mode page. Default 'tabs' keeps legacy behavior — entries
     *  resolve as-is. F6 site-mode-toggle. */
    layoutMode?: 'tabs' | 'scroll' | 'auto';
}

const isExternal = (url: string) => /^https?:\/\/|^mailto:|^tel:/i.test(url);

/** Slugify a page name the same way ScrollNav / MobileNav do — so
 *  footer hash anchors line up with the section ids the public-site
 *  scroll-mode renderer emits. Lowercase + spaces → hyphens. */
const slugifyAnchor = (page: string): string => page.replace(/\s+/g, '-').toLowerCase();

/**
 * Rewrite a footer URL into scroll-mode shape when both:
 *   - The site is in scroll mode (caller's responsibility to gate).
 *   - The URL is page-shaped (`/`, `/about`, `/services/cleaning`) AND
 *     the page-name segment matches a known page in `pages`.
 *
 * URLs that are already hash-anchors (`#contact`) pass through; external
 * URLs (http://, mailto:, tel:) pass through; URLs that don't resolve to
 * a known page pass through (so blog links / file downloads keep working
 * even when the rest of the footer is scroll-mode-aware).
 */
const rewriteForScrollMode = (
    url: string,
    pages: {page: string}[],
): string => {
    if (!url) return url;
    if (url.startsWith('#')) return url;
    if (isExternal(url)) return url;
    // Strip leading `/` and any trailing path segments. A typical footer
    // URL is either `/contact` or `/services/cleaning` — for scroll mode
    // we only know about top-level page anchors, so the first segment is
    // the matching page candidate.
    const trimmed = url.replace(/^\/+/, '').split('/')[0];
    if (!trimmed) return url; // root URL — nothing to rewrite to
    const known = pages.find(p => slugifyAnchor(p.page) === slugifyAnchor(trimmed));
    if (!known) return url;
    return `#${slugifyAnchor(known.page)}`;
};

const renderEntry = (entry: {label: string; url?: string}, key: string | number) => {
    if (!entry.url) return <li key={key}><span>{entry.label}</span></li>;
    if (isExternal(entry.url)) {
        return <li key={key}><a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.label}</a></li>;
    }
    // Hash anchors stay as plain anchors so the browser's native
    // scroll-into-view fires; Next's <Link> would treat `#contact` as a
    // route and try to push it through the router instead.
    if (entry.url.startsWith('#')) {
        return <li key={key}><a href={entry.url}>{entry.label}</a></li>;
    }
    return <li key={key}><Link href={entry.url}>{entry.label}</Link></li>;
};

const SiteFooter: React.FC<Props> = ({config, pages, hasPosts, blogEnabled, t, layoutMode}) => {
    if (!config.enabled) return null;
    const columns: IFooterColumn[] = buildFooterColumns(config, {pages, hasPosts, blogEnabled}, t);
    // F6 — in scroll mode, rewrite page-shaped URLs to `#<slug>` so
    // every footer nav entry stays inside the single scrolling page.
    // External URLs, hash-anchors-already, and unknown page names pass
    // through. `'auto'` resolves to `'tabs'` here per `resolveLayoutMode`
    // semantics — no rewrite.
    const isScroll = layoutMode === 'scroll';
    const projected: IFooterColumn[] = isScroll
        ? columns.map(col => ({
            ...col,
            entries: col.entries.map(e => ({
                ...e,
                url: e.url ? rewriteForScrollMode(e.url, pages) : e.url,
            })),
        }))
        : columns;
    return (
        <footer className="site-footer">
            <RevealOnScroll className="site-footer__columns">
                {projected.map((col, i) => (
                    <div className="site-footer__column" key={i}>
                        <h4>{col.title}</h4>
                        <ul>
                            {col.entries.map((entry, j) => renderEntry(entry, j))}
                        </ul>
                    </div>
                ))}
            </RevealOnScroll>
            {/* Phase 1.A — auth-split-client-admin: account-link column.
             *  Renders null when `siteFlags.auth.clientLoginEnabled === false`. */}
            <AccountLinks/>
            {config.bottom && <div className="site-footer__bottom">{config.bottom}</div>}
        </footer>
    );
};

export default SiteFooter;
export {rewriteForScrollMode}; // exported for unit tests
