import React from 'react';
import type {IFacetConfig} from '@client/lib/facetedFilter';

/**
 * Boolean facet control — a single checkbox. Present-when-true: the
 * facet only constrains the result set when checked (an unchecked box
 * means "no constraint", not "exclude").
 */
export interface BooleanFacetProps {
    testId: string;
    facet: IFacetConfig;
    value?: boolean;
    onChange: (next: boolean) => void;
}

export const BooleanFacet: React.FC<BooleanFacetProps> = ({testId, facet, value, onChange}) => (
    <fieldset className="faceted-facet faceted-facet--boolean" data-testid={testId}>
        <label className="faceted-facet__option">
            <input
                type="checkbox"
                checked={value === true}
                onChange={e => onChange(e.target.checked)}
                data-testid={`${testId}-checkbox`}
            />
            <span className="faceted-facet__option-label">{facet.label}</span>
        </label>
    </fieldset>
);

export default BooleanFacet;
