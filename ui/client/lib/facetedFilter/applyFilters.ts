/**
 * Client-side `FilterState` -> predicate matching.
 *
 * The faceted-filter system is URL-driven; consumers that hold the full
 * result set in memory (the `/products` route, the `/cars` CarsList host
 * — both ≤200-row storefront feeds) filter locally with these helpers
 * rather than round-tripping to the server. A server-side `$facet`
 * aggregation path can land later for large catalogues without changing
 * the URL scheme or the components — only the data source swaps.
 *
 * `accessors` maps a facet key to a value-reader over the item; the page
 * supplies it because item shapes differ (IProduct vs car attributes).
 */
import type {FacetRange, FilterState, IFacetConfig} from './types';

/** Reads the comparable value(s) for one facet off an item. */
export type FacetAccessor<T> = (item: T) => string | string[] | number | boolean | undefined | null;

export interface FacetAccessors<T> {
    [facetKey: string]: FacetAccessor<T>;
}

function matchesMulti(itemValue: ReturnType<FacetAccessor<unknown>>, selected: string[]): boolean {
    if (selected.length === 0) return true;
    const have = Array.isArray(itemValue)
        ? itemValue.map(String)
        : itemValue == null ? [] : [String(itemValue)];
    return selected.some(s => have.includes(s));
}

function matchesRange(itemValue: ReturnType<FacetAccessor<unknown>>, range: FacetRange): boolean {
    const n = typeof itemValue === 'number' ? itemValue : Number(itemValue);
    if (!Number.isFinite(n)) return false;
    if (range.min !== undefined && n < range.min) return false;
    if (range.max !== undefined && n > range.max) return false;
    return true;
}

/** True when `item` satisfies every active facet in `state`. */
export function matchesFilterState<T>(
    item: T,
    state: FilterState,
    facets: IFacetConfig[],
    accessors: FacetAccessors<T>,
): boolean {
    for (const facet of facets) {
        const value = state[facet.key];
        if (value === undefined) continue;
        const read = accessors[facet.key];
        if (!read) continue;
        const itemValue = read(item);
        switch (facet.kind) {
            case 'multi-select':
                if (Array.isArray(value) && !matchesMulti(itemValue, value)) return false;
                break;
            case 'single-select':
                if (typeof value === 'string' && value !== '' && String(itemValue ?? '') !== value) return false;
                break;
            case 'boolean':
                if (value === true && itemValue !== true) return false;
                break;
            case 'range':
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    if (!matchesRange(itemValue, value as FacetRange)) return false;
                }
                break;
        }
    }
    return true;
}

/** Filter a list down to items matching the active filter state. */
export function applyFilterState<T>(
    items: T[],
    state: FilterState,
    facets: IFacetConfig[],
    accessors: FacetAccessors<T>,
): T[] {
    return items.filter(item => matchesFilterState(item, state, facets, accessors));
}

/**
 * Live result counts per facet option, computed against the items that
 * match *every other* facet (so each count answers "how many results if
 * I also pick this option"). Only meaningful for multi/single-select
 * facets — range / boolean facets are skipped.
 */
export function computeFacetCounts<T>(
    items: T[],
    state: FilterState,
    facets: IFacetConfig[],
    accessors: FacetAccessors<T>,
): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    for (const facet of facets) {
        if (facet.kind !== 'multi-select' && facet.kind !== 'single-select') continue;
        const read = accessors[facet.key];
        if (!read) continue;
        // Count against items that satisfy all OTHER facets.
        const otherState: FilterState = {...state};
        delete otherState[facet.key];
        const base = applyFilterState(items, otherState, facets, accessors);
        const counts: Record<string, number> = {};
        for (const item of base) {
            const v = read(item);
            const values = Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)];
            for (const val of values) counts[val] = (counts[val] ?? 0) + 1;
        }
        out[facet.key] = counts;
    }
    return out;
}
