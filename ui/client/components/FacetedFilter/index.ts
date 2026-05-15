/**
 * Faceted-filter UI components — public barrel.
 *
 * The chip / sidebar / facet-control surface for the faceted-filter
 * system (W6b). The filter-state lib lives at
 * `ui/client/lib/facetedFilter/`; these are the React components that
 * render it. `FacetedFilterPanel` is the drop-in wired surface — most
 * pages want that; the individual controls are exported for bespoke
 * layouts (e.g. the `CarsList` module's own control rendering).
 */
export {default as FacetedFilterPanel} from './FacetedFilterPanel';
export type {FacetedFilterPanelProps} from './FacetedFilterPanel';
export {default as FilterChipBar} from './FilterChipBar';
export type {FilterChipBarProps} from './FilterChipBar';
export {default as FacetSidebar} from './FacetSidebar';
export type {FacetSidebarProps} from './FacetSidebar';
export {default as MultiSelectFacet} from './MultiSelectFacet';
export {default as SingleSelectFacet} from './SingleSelectFacet';
export {default as RangeFacet} from './RangeFacet';
export {default as BooleanFacet} from './BooleanFacet';
