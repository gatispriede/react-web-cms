import React from 'react';
import type {
    FacetRange,
    FacetValue,
    FilterState,
    IFacetConfig,
    IFacetOption,
} from '@client/lib/facetedFilter';
import MultiSelectFacet from './MultiSelectFacet';
import SingleSelectFacet from './SingleSelectFacet';
import RangeFacet from './RangeFacet';
import BooleanFacet from './BooleanFacet';

/**
 * Desktop facet sidebar — renders one control per facet, dispatched by
 * `facet.kind`. Facets render in declared `order`. Dynamic taxonomy
 * options + live counts are page-supplied via `optionsByFacet` /
 * `countsByFacet` (the config leaves `options` empty for those).
 *
 * Same component backs the mobile drawer body — the drawer is just this
 * sidebar inside a slide-up container; deferred-apply is a wrapper
 * concern, not this component's.
 */
export interface FacetSidebarProps {
    testId: string;
    facets: IFacetConfig[];
    state: FilterState;
    /** Page-supplied options per facet key (taxonomy facets are dynamic). */
    optionsByFacet?: Record<string, IFacetOption[]>;
    /** Page-supplied live result counts per facet key. */
    countsByFacet?: Record<string, Record<string, number>>;
    onSetFacet: (key: string, value: FacetValue) => void;
}

export const FacetSidebar: React.FC<FacetSidebarProps> = ({
    testId, facets, state, optionsByFacet, countsByFacet, onSetFacet,
}) => {
    const ordered = [...facets].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
    return (
        <aside className="faceted-filter-sidebar" data-testid={testId} aria-label="Filters">
            {ordered.map(facet => {
                const facetTestId = `${testId}-facet-${facet.key}`;
                const options = optionsByFacet?.[facet.key] ?? facet.options ?? [];
                const counts = countsByFacet?.[facet.key];
                switch (facet.kind) {
                    case 'multi-select':
                        return (
                            <MultiSelectFacet
                                key={facet.key}
                                testId={facetTestId}
                                facet={facet}
                                options={options}
                                selected={Array.isArray(state[facet.key]) ? (state[facet.key] as string[]) : []}
                                counts={counts}
                                onChange={next => onSetFacet(facet.key, next)}
                            />
                        );
                    case 'single-select':
                        return (
                            <SingleSelectFacet
                                key={facet.key}
                                testId={facetTestId}
                                facet={facet}
                                options={options}
                                selected={typeof state[facet.key] === 'string' ? (state[facet.key] as string) : undefined}
                                counts={counts}
                                onChange={next => onSetFacet(facet.key, next)}
                            />
                        );
                    case 'range':
                        return (
                            <RangeFacet
                                key={facet.key}
                                testId={facetTestId}
                                facet={facet}
                                value={
                                    state[facet.key] && typeof state[facet.key] === 'object' && !Array.isArray(state[facet.key])
                                        ? (state[facet.key] as FacetRange)
                                        : undefined
                                }
                                onChange={next => onSetFacet(facet.key, next)}
                            />
                        );
                    case 'boolean':
                        return (
                            <BooleanFacet
                                key={facet.key}
                                testId={facetTestId}
                                facet={facet}
                                value={state[facet.key] === true}
                                onChange={next => onSetFacet(facet.key, next)}
                            />
                        );
                    default:
                        return null;
                }
            })}
        </aside>
    );
};

export default FacetSidebar;
