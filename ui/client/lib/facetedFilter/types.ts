/**
 * Faceted-filter system — shared types.
 *
 * A generic, reusable faceted-filter surface for product / inventory
 * list views (W6b roadmap item). The same primitives power the
 * `/products` route and the `/cars` `CarsList` module.
 *
 * Design note: facet *configs* are code-defined per consuming route
 * (see `productListConfig.ts`) — they are NOT operator-authored content,
 * so they need no admin UI / MCP coverage. The one operator/customer
 * editable surface this system introduces is the **saved search**,
 * which gets its MCP tool (`services/features/Mcp/tools/savedSearch.ts`).
 */

export type FacetKind = 'multi-select' | 'single-select' | 'range' | 'boolean';

export interface IFacetOption {
    value: string;
    label: string;
}

export interface IFacetConfig {
    /** URL key, e.g. 'make', 'price', 'fuel'. */
    key: string;
    /** Human label rendered above the control + inside chips. */
    label: string;
    kind: FacetKind;
    /** Inline options for multi/single-select facets. When omitted the
     *  consumer is expected to supply live options at render time. */
    options?: IFacetOption[];
    /** For range facets — bounds + step + optional unit suffix. */
    range?: {min: number; max: number; step: number; unit?: string};
    /** Facet dependency, e.g. Model depends on Make. The dependant facet's
     *  value is cleared whenever the parent changes. */
    dependsOn?: string;
    /** Display priority — lower renders earlier. */
    order: number;
}

export interface IProductListConfig {
    /** Route discriminator: 'products', 'cars', … */
    slug: string;
    title: string;
    facets: IFacetConfig[];
}

/**
 * Parsed filter state. Keyed by facet key.
 *  - multi-select  → string[]
 *  - single-select → string
 *  - boolean       → true (key present) — absent means "no constraint"
 *  - range         → {min?: number; max?: number}
 */
export type FacetRange = {min?: number; max?: number};
export type FacetValue = string[] | string | boolean | FacetRange | undefined;
export type FilterState = Record<string, FacetValue>;

/** One pinned applied-filter chip. */
export interface IFilterChip {
    /** Stable testid-safe id, e.g. `make-audi` or `price`. */
    id: string;
    facetKey: string;
    label: string;
    /** For multi-select chips — the single option this chip removes.
     *  Undefined for range / single-select / boolean (whole-facet chip). */
    optionValue?: string;
}

/** A persisted saved search (localStorage-backed in this chunk;
 *  `services/features/Mcp/tools/savedSearch.ts` is the canonical
 *  write path once a server backend lands). */
export interface ISavedSearch {
    id: string;
    listSlug: string;
    title: string;
    /** Canonical query string — `?make=audi,bmw&price=2000-25000`. */
    filterQuery: string;
    createdAt: string;
}
