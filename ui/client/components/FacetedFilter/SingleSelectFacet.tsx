import React from 'react';
import type {IFacetConfig, IFacetOption} from '@client/lib/facetedFilter';

/**
 * Single-select facet control — a radio group with an "Any" reset.
 * Live counts render after each label when supplied; zero-count options
 * stay visible but disabled.
 */
export interface SingleSelectFacetProps {
    testId: string;
    facet: IFacetConfig;
    /** Options — falls back to `facet.options` when not page-supplied. */
    options?: IFacetOption[];
    /** Selected value, or `undefined` for "Any". */
    selected?: string;
    counts?: Record<string, number>;
    onChange: (next: string | undefined) => void;
}

export const SingleSelectFacet: React.FC<SingleSelectFacetProps> = ({
    testId, facet, options, selected, counts, onChange,
}) => {
    const opts = options ?? facet.options ?? [];
    return (
        <fieldset className="faceted-facet faceted-facet--single" data-testid={testId}>
            <legend className="faceted-facet__legend">{facet.label}</legend>
            <label className="faceted-facet__option" data-testid={`${testId}-option-any`}>
                <input
                    type="radio"
                    name={`${testId}-radio`}
                    checked={selected === undefined || selected === ''}
                    onChange={() => onChange(undefined)}
                    data-testid={`${testId}-radio-any`}
                />
                <span className="faceted-facet__option-label">Any</span>
            </label>
            {opts.map(opt => {
                const count = counts?.[opt.value];
                const zero = count === 0;
                const checked = selected === opt.value;
                return (
                    <label
                        key={opt.value}
                        className={`faceted-facet__option${zero && !checked ? ' faceted-facet__option--zero' : ''}`}
                        data-testid={`${testId}-option-${opt.value}`}
                    >
                        <input
                            type="radio"
                            name={`${testId}-radio`}
                            checked={checked}
                            disabled={zero && !checked}
                            onChange={() => onChange(opt.value)}
                            data-testid={`${testId}-radio-${opt.value}`}
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

export default SingleSelectFacet;
