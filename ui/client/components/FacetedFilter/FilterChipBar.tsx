import React from 'react';
import type {FilterState, IFacetConfig, IFilterChip} from '@client/lib/facetedFilter';
import {deriveChips} from '@client/lib/facetedFilter';

/**
 * Pinned applied-filter chip bar.
 *
 * Renders one removable chip per active facet value (multi-select facets
 * emit one chip per value; range / single-select / boolean emit a single
 * whole-facet chip — see `deriveChips`). A trailing "Clear all" appears
 * whenever ≥1 chip is shown. Renders `null` when nothing is filtered.
 */
export interface FilterChipBarProps {
    testId: string;
    state: FilterState;
    facets: IFacetConfig[];
    /** Remove one chip (a single multi-select value, or a whole facet). */
    onRemoveChip: (chip: IFilterChip) => void;
    /** Clear every facet. */
    onClearAll: () => void;
}

export const FilterChipBar: React.FC<FilterChipBarProps> = ({testId, state, facets, onRemoveChip, onClearAll}) => {
    const chips = deriveChips(state, facets);
    if (chips.length === 0) return null;
    return (
        <div className="faceted-filter-chips" data-testid={testId} role="group" aria-label="Applied filters">
            {chips.map(chip => (
                <button
                    key={chip.id}
                    type="button"
                    className="faceted-filter-chips__chip"
                    data-testid={`${testId}-chip-${chip.id}`}
                    onClick={() => onRemoveChip(chip)}
                    aria-label={`Remove filter ${chip.label}`}
                >
                    <span className="faceted-filter-chips__chip-label">{chip.label}</span>
                    <span className="faceted-filter-chips__chip-x" aria-hidden="true">×</span>
                </button>
            ))}
            <button
                type="button"
                className="faceted-filter-chips__clear"
                data-testid={`${testId}-clear-all`}
                onClick={onClearAll}
            >Clear all</button>
        </div>
    );
};

export default FilterChipBar;
