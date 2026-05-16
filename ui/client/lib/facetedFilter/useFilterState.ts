/**
 * `useFilterState` — the URL <-> FilterState binding hook.
 *
 * Every facet value lives in the page query string (see `filterUrl.ts`
 * for the scheme). The hook:
 *   - parses the current URL query string into a typed `FilterState` on
 *     every render (memoised against the query),
 *   - exposes `setFacet` / `clearFacet` / `clearAll` mutators that push
 *     a canonical query back through `router.replace(...)`,
 *   - honours facet `dependsOn`: changing a parent facet clears its
 *     dependants (e.g. picking a new Make wipes the Model selection).
 *
 * Router-API note: this hook used to read `router.query` from
 * `next/router` (Pages Router). That hook returns `null` under App
 * Router, so the read moved to `useSearchParams()` from `next/navigation`
 * — the `next/navigation` hooks are App-Router-native AND work fine in
 * Pages Router (Next 13+). `router.replace` similarly moved to
 * `next/navigation`'s `useRouter`. The old `{shallow: true}` flag has no
 * App-Router equivalent because App Router doesn't re-run server
 * components for a same-route query change: the new query just flows
 * through to client hooks, which is the same outcome shallow routing
 * used to give us on the Pages Router.
 */
import {useCallback, useMemo} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import type {FacetValue, FilterState, IFacetConfig} from './types';
import {parseFilterUrl, serializeFilterUrl, toCanonicalQueryString} from './filterUrl';

export interface UseFilterStateResult {
    /** Parsed, typed filter state derived from the URL. */
    state: FilterState;
    /** Canonical `?a=b&c=d` string for the current state (shareable). */
    queryString: string;
    /** Set (or clear, when value is `undefined`) one facet. */
    setFacet: (key: string, value: FacetValue) => void;
    /** Clear a single facet. */
    clearFacet: (key: string) => void;
    /** Clear every facet. */
    clearAll: () => void;
    /** Replace the whole state at once (used by saved-search apply). */
    replaceState: (next: FilterState) => void;
}

/** Keys that declare `dependsOn === key` — cleared when `key` changes. */
function dependantsOf(key: string, facets: IFacetConfig[]): string[] {
    return facets.filter(f => f.dependsOn === key).map(f => f.key);
}

/** Flatten URLSearchParams into the `{k: v | v[]}` shape `parseFilterUrl` expects. */
function searchToQuery(search: URLSearchParams | null): Record<string, string | string[] | undefined> {
    if (!search) return {};
    const out: Record<string, string | string[] | undefined> = {};
    for (const key of new Set(Array.from(search.keys()))) {
        const all = search.getAll(key);
        out[key] = all.length > 1 ? all : all[0];
    }
    return out;
}

export function useFilterState(facets: IFacetConfig[]): UseFilterStateResult {
    const router = useRouter();
    const pathname = usePathname() ?? '/';
    const search = useSearchParams();

    const state = useMemo<FilterState>(
        () => parseFilterUrl(searchToQuery(search), facets),
        [search, facets],
    );

    const push = useCallback((next: FilterState) => {
        const query = serializeFilterUrl(next, facets);
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(query)) {
            if (v === undefined) continue;
            if (Array.isArray(v)) for (const item of v) params.append(k, item);
            else params.set(k, v);
        }
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, {scroll: false});
    }, [router, pathname, facets]);

    const setFacet = useCallback((key: string, value: FacetValue) => {
        const next: FilterState = {...state};
        const empty =
            value === undefined ||
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === 'string' && value === '') ||
            value === false;
        if (empty) delete next[key];
        else next[key] = value;
        // Cascading: clearing/changing a parent facet invalidates dependants.
        for (const dep of dependantsOf(key, facets)) delete next[dep];
        push(next);
    }, [state, facets, push]);

    const clearFacet = useCallback((key: string) => setFacet(key, undefined), [setFacet]);

    const clearAll = useCallback(() => {
        router.replace(pathname, {scroll: false});
    }, [router, pathname]);

    const replaceState = useCallback((next: FilterState) => push(next), [push]);

    const queryString = useMemo(() => toCanonicalQueryString(state, facets), [state, facets]);

    return {state, queryString, setFacet, clearFacet, clearAll, replaceState};
}
