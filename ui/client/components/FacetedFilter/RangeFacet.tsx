import React, {useState} from 'react';
import type {FacetRange, IFacetConfig} from '@client/lib/facetedFilter';

/**
 * Range facet control — paired min/max number inputs. The text inputs
 * are the source of truth (per the spec); they commit on blur / Enter so
 * a partially-typed value doesn't thrash the URL on every keystroke.
 * Open-ended ranges are allowed — leaving min or max blank.
 */
export interface RangeFacetProps {
    testId: string;
    facet: IFacetConfig;
    value?: FacetRange;
    onChange: (next: FacetRange | undefined) => void;
}

function toNum(raw: string): number | undefined {
    const t = raw.trim();
    if (t === '') return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
}

/** Internal RangeFacet body — remounted via `key` whenever the external
 *  `value` changes (back-button, chip removal), so the text-input state
 *  re-seeds from props without a setState-in-effect. */
const RangeFacetBody: React.FC<RangeFacetProps> = ({testId, facet, value, onChange}) => {
    const [minText, setMinText] = useState<string>(value?.min !== undefined ? String(value.min) : '');
    const [maxText, setMaxText] = useState<string>(value?.max !== undefined ? String(value.max) : '');

    const commit = () => {
        const min = toNum(minText);
        const max = toNum(maxText);
        if (min === undefined && max === undefined) {
            onChange(undefined);
            return;
        }
        const next: FacetRange = {};
        if (min !== undefined) next.min = min;
        if (max !== undefined) next.max = max;
        onChange(next);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        }
    };

    const unit = facet.range?.unit;
    return (
        <fieldset className="faceted-facet faceted-facet--range" data-testid={testId}>
            <legend className="faceted-facet__legend">
                {facet.label}{unit ? ` (${unit})` : ''}
            </legend>
            <div className="faceted-facet__range-row">
                <label className="faceted-facet__range-field">
                    <span className="faceted-facet__range-label">Min</span>
                    <input
                        type="number"
                        className="faceted-facet__range-input"
                        value={minText}
                        min={facet.range?.min}
                        max={facet.range?.max}
                        step={facet.range?.step}
                        placeholder={facet.range ? String(facet.range.min) : undefined}
                        onChange={e => setMinText(e.target.value)}
                        onBlur={commit}
                        onKeyDown={onKeyDown}
                        data-testid={`${testId}-min`}
                    />
                </label>
                <span className="faceted-facet__range-sep" aria-hidden="true">–</span>
                <label className="faceted-facet__range-field">
                    <span className="faceted-facet__range-label">Max</span>
                    <input
                        type="number"
                        className="faceted-facet__range-input"
                        value={maxText}
                        min={facet.range?.min}
                        max={facet.range?.max}
                        step={facet.range?.step}
                        placeholder={facet.range ? String(facet.range.max) : undefined}
                        onChange={e => setMaxText(e.target.value)}
                        onBlur={commit}
                        onKeyDown={onKeyDown}
                        data-testid={`${testId}-max`}
                    />
                </label>
            </div>
        </fieldset>
    );
};

/**
 * Range facet control. The `key` re-seeds the text-input state from
 * props whenever the URL-driven `value` changes underneath us — the
 * React-recommended alternative to a setState-in-effect sync.
 */
export const RangeFacet: React.FC<RangeFacetProps> = (props) => (
    <RangeFacetBody
        key={`${props.value?.min ?? ''}-${props.value?.max ?? ''}`}
        {...props}
    />
);

export default RangeFacet;
