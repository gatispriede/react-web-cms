/**
 * Derives the pinned applied-filter chip bar from FilterState.
 *
 * Multi-select facets emit one chip per selected option (one-click
 * removal of a single value); single-select / boolean / range emit a
 * single whole-facet chip.
 */
import type {FacetRange, FilterState, IFacetConfig, IFilterChip} from './types';

function optionLabel(facet: IFacetConfig, value: string): string {
    const opt = facet.options?.find(o => o.value === value);
    return opt?.label ?? value;
}

function formatRange(facet: IFacetConfig, r: FacetRange): string {
    const unit = facet.range?.unit ?? '';
    const fmt = (n: number) => (unit ? `${n}${unit}` : String(n));
    if (r.min !== undefined && r.max !== undefined) return `${fmt(r.min)}–${fmt(r.max)}`;
    if (r.min !== undefined) return `≥ ${fmt(r.min)}`;
    if (r.max !== undefined) return `≤ ${fmt(r.max)}`;
    return '';
}

export function deriveChips(state: FilterState, facets: IFacetConfig[]): IFilterChip[] {
    const chips: IFilterChip[] = [];
    const ordered = [...facets].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
    for (const facet of ordered) {
        const value = state[facet.key];
        if (value === undefined) continue;
        if (facet.kind === 'multi-select' && Array.isArray(value)) {
            for (const v of value) {
                chips.push({
                    id: `${facet.key}-${v}`,
                    facetKey: facet.key,
                    optionValue: v,
                    label: `${facet.label}: ${optionLabel(facet, v)}`,
                });
            }
        } else if (facet.kind === 'single-select' && typeof value === 'string' && value !== '') {
            chips.push({
                id: facet.key,
                facetKey: facet.key,
                label: `${facet.label}: ${optionLabel(facet, value)}`,
            });
        } else if (facet.kind === 'boolean' && value === true) {
            chips.push({id: facet.key, facetKey: facet.key, label: facet.label});
        } else if (facet.kind === 'range' && value && typeof value === 'object' && !Array.isArray(value)) {
            const text = formatRange(facet, value as FacetRange);
            if (text) chips.push({id: facet.key, facetKey: facet.key, label: `${facet.label}: ${text}`});
        }
    }
    return chips;
}

/** Remove one chip from the state — a single multi-select value, or a
 *  whole facet. Returns a new FilterState (does not mutate). */
export function removeChip(state: FilterState, chip: IFilterChip): FilterState {
    const next: FilterState = {...state};
    const current = next[chip.facetKey];
    if (chip.optionValue !== undefined && Array.isArray(current)) {
        const remaining = current.filter(v => v !== chip.optionValue);
        if (remaining.length > 0) next[chip.facetKey] = remaining;
        else delete next[chip.facetKey];
    } else {
        delete next[chip.facetKey];
    }
    return next;
}
