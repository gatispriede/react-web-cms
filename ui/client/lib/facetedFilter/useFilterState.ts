/**
 * `useFilterState` — the URL <-> FilterState binding hook.
 *
 * Every facet value lives in the page query string (see `filterUrl.ts`
 * for the scheme). The hook:
 *   - parses `router.query` into a typed `FilterState` on every render
 *     (memoised against the query),
 *   - exposes `setFacet` / `clearFacet` / `clearAll` mutators that push
 *     a canonical query back through `router.replace(..., {shallow})`,
 *   - honours facet `dependsOn`: changing a parent facet clears its
 *     dependants (e.g. picking a new Make wipes the Model selection).
 *
 * `shallow: true` keeps the change client-side — no getServerSideProps
 * re-run — while still updating the address bar so refresh / back-button
 * / copy-paste all reproduce the exact result set.
 */
import {useCallback, useMemo} from 'react';
import {useRouter} from 'next/router';
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

export function useFilterState(facets: IFacetConfig[]): UseFilterStateResult {
    const router = useRouter();

    const state = useMemo<FilterState>(
        () => parseFilterUrl(router.query as Record<string, string | string[] | undefined>, facets),
        [router.query, facets],
    );

    const push = useCallback((next: FilterState) => {
        const query = serializeFilterUrl(next, facets);
        void router.replace({pathname: router.pathname, query}, undefined, {shallow: true, scroll: false});
    }, [router, facets]);

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
        void router.replace({pathname: router.pathname, query: {}}, undefined, {shallow: true, scroll: false});
    }, [router]);

    const replaceState = useCallback((next: FilterState) => push(next), [push]);

    const queryString = useMemo(() => toCanonicalQueryString(state, facets), [state, facets]);

    return {state, queryString, setFacet, clearFacet, clearAll, replaceState};
}
