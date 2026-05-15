/**
 * Breadcrumb — Phase 1.C + BreadcrumbBar enhancements (new-modules-catalogue.md).
 *
 * Renders a horizontal page-chain. When `autoFromParentChain` is true,
 * the rendering page provides the resolved chain via the `crumbs` prop
 * (resolved server-side from `IPage.parent` walking the full ancestry —
 * no depth cap, per Phase 0b).
 *
 * Used both as an auto-injected section on warehouse-derived category
 * pages AND as a free-standing module operators can drop anywhere.
 *
 * BreadcrumbBar adds:
 *  - Schema.org `BreadcrumbList` JSON-LD next to the visible <nav>
 *    (toggleable via `schemaOrg`, defaults to on; gives SEO the same
 *    parent chain humans see).
 *  - Mobile collapse to "← Back" + current page title (CSS-driven;
 *    `mobileBehavior: 'full'` opts out).
 */
import React from 'react';
import type {IBreadcrumb, IBreadcrumbCrumb} from './Breadcrumb.types';

export interface BreadcrumbProps {
    content: IBreadcrumb | string;
    /** Resolved crumbs from the page context. Used when
     *  `autoFromParentChain` is true (the default). */
    crumbs?: IBreadcrumbCrumb[];
    /** Absolute site origin used when materialising `BreadcrumbList`
     *  `item` URLs. Default `''` — yields relative URLs, which is fine
     *  for SSR but suboptimal for crawler hints. Page wrappers should
     *  pass the canonical origin (e.g. `https://example.com`). */
    origin?: string;
}

function parseContent(raw: string | IBreadcrumb): IBreadcrumb {
    if (typeof raw === 'string') {
        try { return JSON.parse(raw) as IBreadcrumb; } catch { return {autoFromParentChain: true}; }
    }
    return raw;
}

function buildJsonLd(crumbs: IBreadcrumbCrumb[], origin: string): string {
    const absolutise = (href: string): string => {
        if (!origin) return href;
        if (/^https?:\/\//i.test(href)) return href;
        return `${origin.replace(/\/$/, '')}${href.startsWith('/') ? href : `/${href}`}`;
    };
    const ld = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.label,
            item: absolutise(c.href),
        })),
    };
    return JSON.stringify(ld);
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({content, crumbs: injected, origin = ''}) => {
    const c = parseContent(content);
    const auto = c.autoFromParentChain !== false;
    const crumbs = auto ? (injected ?? []) : (c.crumbs ?? []);
    const sep = c.separator ?? '›';
    const emitSchema = c.schemaOrg !== false;
    const mobile = c.mobileBehavior ?? 'collapse-to-back';
    const backLabel = c.backLabel ?? 'Back';

    if (crumbs.length === 0) {
        return (
            <nav className="breadcrumb breadcrumb--empty" aria-label="Breadcrumb" data-testid="breadcrumb-empty" />
        );
    }

    const collapseClass = mobile === 'collapse-to-back' ? ' breadcrumb--mobile-collapse' : '';
    const last = crumbs[crumbs.length - 1];
    const parent = crumbs.length >= 2 ? crumbs[crumbs.length - 2] : null;

    return (
        <nav
            className={`breadcrumb${collapseClass}`}
            aria-label="Breadcrumb"
            data-testid="breadcrumb"
        >
            <ol className="breadcrumb__full">
                {crumbs.map((c, i) => {
                    const isLast = i === crumbs.length - 1;
                    return (
                        <li key={`${c.href}-${i}`} data-testid={`breadcrumb-${i}`}>
                            {isLast
                                ? <span aria-current="page">{c.label}</span>
                                : <a href={c.href}>{c.label}</a>}
                            {!isLast && <span className="breadcrumb__sep" aria-hidden> {sep} </span>}
                        </li>
                    );
                })}
            </ol>

            {mobile === 'collapse-to-back' && (
                <div className="breadcrumb__mobile" data-testid="breadcrumb-mobile" aria-hidden={false}>
                    {parent ? (
                        <a
                            href={parent.href}
                            className="breadcrumb__back"
                            data-testid="breadcrumb-back"
                        >&larr; {backLabel}</a>
                    ) : null}
                    <span className="breadcrumb__current" aria-current="page" data-testid="breadcrumb-current">
                        {last.label}
                    </span>
                </div>
            )}

            {emitSchema && (
                <script
                    type="application/ld+json"
                    data-testid="breadcrumb-jsonld"
                    dangerouslySetInnerHTML={{__html: buildJsonLd(crumbs, origin)}}
                />
            )}
        </nav>
    );
};

export default Breadcrumb;
export {Breadcrumb};
