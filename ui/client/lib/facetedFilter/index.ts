/**
 * Faceted-filter system — public barrel.
 *
 * The reusable faceted-filter primitives for product / inventory list
 * views (W6b roadmap item). Consumed by `/products` and the `/cars`
 * `CarsList` module.
 *
 *   - `types`             — shared shapes (IFacetConfig, FilterState, …)
 *   - `filterUrl`         — URL <-> state codec (canonical query string)
 *   - `chips`             — derive / remove pinned applied-filter chips
 *   - `useFilterState`    — Next-router URL binding hook
 *   - `savedSearches`     — localStorage-backed saved-search store
 *   - `productListConfig` — per-route facet configs
 *
 * Chip / sidebar UI components live under
 * `ui/client/components/FacetedFilter/`.
 */
export * from './types';
export * from './filterUrl';
export * from './chips';
export * from './useFilterState';
export * from './savedSearches';
export * from './productListConfig';
export * from './applyFilters';
