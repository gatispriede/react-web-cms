/**
 * Per-route facet configurations.
 *
 * These configs are CODE-DEFINED, not operator-authored content — they
 * describe the shape of each list route's filter sidebar, the same way a
 * component's prop types are code. There is therefore no admin UI / MCP
 * surface for them (see the design note in `types.ts`). The one editable
 * surface this system introduces — the customer's *saved search* — is
 * handled by `savedSearches.ts`.
 *
 * Adding a new faceted list route = add an `IProductListConfig` here and
 * point the page at it.
 */
import type {IProductListConfig} from './types';

/**
 * `/products` — the generic commerce list. Category multi-select +
 * price range + in-stock boolean. Options for `category` are injected at
 * render time from the live product set (the config leaves `options`
 * empty; the page fills them).
 */
export const PRODUCTS_LIST_CONFIG: IProductListConfig = {
    slug: 'products',
    title: 'Products',
    facets: [
        {
            key: 'price',
            label: 'Price',
            kind: 'range',
            range: {min: 0, max: 100_000, step: 10, unit: '€'},
            order: 1,
        },
        {
            key: 'category',
            label: 'Category',
            kind: 'multi-select',
            order: 2,
            // options injected at render time from the product set
        },
        {
            key: 'instock',
            label: 'In stock only',
            kind: 'boolean',
            order: 3,
        },
    ],
};

/**
 * `/cars` — the cars vertical. Cascading make → model multi-select,
 * price / year / mileage ranges, fuel + gearbox single-selects. The
 * `CarsList` module owns its own control rendering today; this config is
 * the shared source of truth for chip derivation + URL codec so `/cars`
 * gets the same shareable-URL behaviour as `/products`.
 */
export const CARS_LIST_CONFIG: IProductListConfig = {
    slug: 'cars',
    facets: [
        {key: 'price', label: 'Price', kind: 'range', range: {min: 0, max: 200_000, step: 100, unit: '€'}, order: 1},
        {key: 'year', label: 'Year', kind: 'range', range: {min: 1990, max: 2026, step: 1}, order: 2},
        {key: 'mileage', label: 'Mileage', kind: 'range', range: {min: 0, max: 500_000, step: 5_000, unit: 'km'}, order: 3},
        {key: 'make', label: 'Make', kind: 'multi-select', order: 10},
        {key: 'model', label: 'Model', kind: 'multi-select', dependsOn: 'make', order: 11},
        {
            key: 'fuel',
            label: 'Fuel',
            kind: 'single-select',
            order: 20,
            options: [
                {value: 'petrol', label: 'Petrol'},
                {value: 'diesel', label: 'Diesel'},
                {value: 'hybrid', label: 'Hybrid'},
                {value: 'electric', label: 'Electric'},
                {value: 'lpg', label: 'LPG'},
            ],
        },
        {
            key: 'gearbox',
            label: 'Gearbox',
            kind: 'single-select',
            order: 21,
            options: [
                {value: 'manual', label: 'Manual'},
                {value: 'automatic', label: 'Automatic'},
            ],
        },
    ],
    title: 'Cars',
};
