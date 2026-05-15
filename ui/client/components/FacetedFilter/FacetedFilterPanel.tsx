import React, {useCallback, useMemo, useState} from 'react';
import {useSession} from 'next-auth/react';
import type {IFacetConfig, IFacetOption, IProductListConfig} from '@client/lib/facetedFilter';
import {
    addSavedSearch,
    removeChip,
    useFilterState,
} from '@client/lib/facetedFilter';
import SaveSearchPrompt from '@client/lib/SaveSearchPrompt/SaveSearchPrompt';
import FilterChipBar from './FilterChipBar';
import FacetSidebar from './FacetSidebar';

/**
 * `FacetedFilterPanel` — the wired faceted-filter surface.
 *
 * Composes the three pieces of the system into one drop-in component:
 *   1. URL state binding (`useFilterState`) — every facet value is in
 *      the query string, so refresh / back-button / copy-paste all
 *      reproduce the result set.
 *   2. The desktop facet sidebar + the pinned applied-filter chip bar.
 *   3. The saved-search integration: a `SaveSearchPrompt` that, on save,
 *      persists the current canonical query string via the
 *      `savedSearches` store (localStorage today; server-backed + alert
 *      worker land with the customer-account roadmap item). The prompt
 *      only surfaces for logged-in customers — guests never see it.
 *
 * The page owns the *result list* + supplies dynamic taxonomy options /
 * live counts; this panel owns everything filter-state.
 */
export interface FacetedFilterPanelProps {
    /** Stable testid prefix, e.g. `products-filter`. */
    testId: string;
    config: IProductListConfig;
    /** Dynamic taxonomy options per facet key (e.g. live category list). */
    optionsByFacet?: Record<string, IFacetOption[]>;
    /** Live result counts per facet key. */
    countsByFacet?: Record<string, Record<string, number>>;
    /** Current total result count — shown in the save-search activity key. */
    resultCount?: number;
}

export const FacetedFilterPanel: React.FC<FacetedFilterPanelProps> = ({
    testId, config, optionsByFacet, countsByFacet, resultCount,
}) => {
    const facets: IFacetConfig[] = config.facets;
    const {state, queryString, setFacet, clearAll, replaceState} = useFilterState(facets);
    const {data: session} = useSession();
    const loggedIn = (session?.user as {kind?: string} | undefined)?.kind === 'customer';
    const [savedNote, setSavedNote] = useState<string | null>(null);

    const onRemoveChip = useCallback((chip: Parameters<typeof removeChip>[1]) => {
        replaceState(removeChip(state, chip));
    }, [state, replaceState]);

    const handleSaveSearch = useCallback(() => {
        const record = addSavedSearch({
            listSlug: config.slug,
            title: config.title || config.slug,
            filterQuery: queryString,
        });
        setSavedNote(`Saved "${record.title}". Manage it in your account.`);
    }, [config.slug, config.title, queryString]);

    // Activity key bumps whenever the filter URL changes — restarts the
    // SaveSearchPrompt's 5s dwell timer (see SaveSearchPrompt.types.ts).
    const activityKey = useMemo(() => `${queryString}|${resultCount ?? ''}`, [queryString, resultCount]);

    return (
        <div className="faceted-filter-panel" data-testid={testId}>
            <FilterChipBar
                testId={`${testId}-chips`}
                state={state}
                facets={facets}
                onRemoveChip={onRemoveChip}
                onClearAll={clearAll}
            />
            <FacetSidebar
                testId={`${testId}-sidebar`}
                facets={facets}
                state={state}
                optionsByFacet={optionsByFacet}
                countsByFacet={countsByFacet}
                onSetFacet={setFacet}
            />
            <SaveSearchPrompt
                testId={`${testId}-save-search`}
                persistKey={`facetedFilter.${config.slug}`}
                loggedIn={loggedIn}
                activityKey={activityKey}
                onSave={handleSaveSearch}
            />
            {savedNote && (
                <p className="faceted-filter-panel__saved-note" data-testid={`${testId}-saved-note`} role="status">
                    {savedNote}
                </p>
            )}
        </div>
    );
};

export default FacetedFilterPanel;
