import React from 'react';
import type {IFacetConfig, IFacetOption} from '@client/lib/facetedFilter';

/**
 * Multi-select facet control — a checkbox list. Live result counts (when
 * supplied) render after each label; zero-count options stay VISIBLE but
 * disabled (Baymard: hiding them destabilises the list and confuses
 * users). Options are passed in by the page so taxonomy facets can be
 * driven from the live product set / cascade.
 */
export interface MultiSelectFacetProps {
    testId: string;
    facet: IFacetConfig;
    /** Options to render — page-supplied (taxonomy facets are dynamic). */
    options: IFacetOption[];
    /** Currently-selected values. */
    selected: string[];
    /** Per-option live result counts, keyed by option value. */
    counts?: Record<string, number>;
    onChange: (next: string[]) => void;
}

export const MultiSelectFacet: React.FC<MultiSelectFacetProps> = ({
    testId, facet, options, selected, counts, onChange,
}) => {
    const toggle = (value: string) => {
        const set = new Set(selected);
        if (set.has(value)) set.delete(value);
        else set.add(value);
        onChange([...set].sort());
    };
    return (
        <fieldset className="faceted-facet faceted-facet--multi" data-testid={testId}>
            <legend className="faceted-facet__legend">{facet.label}</legend>
            {options.length === 0 && (
                <p className="faceted-facet__empty" data-testid={`${testId}-empty`}>No options</p>
            )}
            {options.map(opt => {
                const count = counts?.[opt.value];
                const zero = count === 0;
                const checked = selected.includes(opt.value);
                return (
                    <label
                        key={opt.value}
                        className={`faceted-facet__option${zero && !checked ? ' faceted-facet__option--zero' : ''}`}
                        data-testid={`${testId}-option-${opt.value}`}
                    >
                        <input
                            type="checkbox"
                            checked={checked}
                            disabled={zero && !checked}
                            onChange={() => toggle(opt.value)}
                            data-testid={`${testId}-checkbox-${opt.value}`}
                        />
                        <span className="faceted-facet__option-label">{opt.label}</span>
                        {typeof count === 'number' && (
                            <span className="faceted-facet__option-count">({count})</span>
                        )}
                    </label>
                );
            })}
        </fieldset>
    );
};

export default MultiSelectFacet;
