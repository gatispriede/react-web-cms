/**
 * Phase 1.C — Breadcrumb types.
 * Auto-walks the IPage parent chain N-deep (no depth cap — Phase 0b
 * lifted the cap to a soft warning at 8).
 */
export interface IBreadcrumbCrumb {
    label: string;
    href: string;
}

export interface IBreadcrumb {
    /** When true, the renderer ignores `crumbs[]` and rebuilds the chain
     *  from `parent` links at request time. Default true. */
    autoFromParentChain?: boolean;
    /** Operator-curated override — only consumed when `autoFromParentChain === false`. */
    crumbs?: IBreadcrumbCrumb[];
    /** Separator glyph between crumbs. Default `›`. */
    separator?: string;
}

export enum EBreadcrumbStyle {
    Default = 'default',
    Compact = 'compact',
}
