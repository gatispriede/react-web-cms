/**
 * Phase 1.C — Breadcrumb types.
 * Auto-walks the IPage parent chain N-deep (no depth cap — Phase 0b
 * lifted the cap to a soft warning at 8).
 *
 * BreadcrumbBar enhancement (new-modules-catalogue.md, cross-theme shared):
 * - `schemaOrg`: emits a `BreadcrumbList` JSON-LD next to the visible <nav>.
 * - `mobileBehavior`: `"collapse-to-back"` swaps the full chain for a
 *   "← Back" link + current page title at narrow viewports (CSS-driven).
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
    /** Emit a Schema.org BreadcrumbList JSON-LD alongside the <nav>.
     *  Default true — disable only when the page already injects a
     *  document-level BreadcrumbList (avoid duplication). */
    schemaOrg?: boolean;
    /** How the bar shrinks on narrow viewports.
     *  - `"collapse-to-back"` (default): full chain hides; a "← Back" link
     *    pointing at the parent crumb + the current page title shows.
     *  - `"full"`: keep the full chain regardless of viewport. */
    mobileBehavior?: 'collapse-to-back' | 'full';
    /** Mobile back-link label override. Default `"Back"`. */
    backLabel?: string;
}

export enum EBreadcrumbStyle {
    Default = 'default',
    Compact = 'compact',
    Pills = 'pills',
    Slash = 'slash',
    Arrow = 'arrow',
}
