---
name: storefront-faceted-filter-system
description: Reusable faceted filter system for product / inventory lists. Multi-select make/model, range sliders, live counts, pinned chips, saved searches + alerts. First consumer = ss.com cars; generalises to any product list.
research: see research-findings-2026-05-12.md §3 Filter UX patterns specific to cars + Baymard filter UX guidance
---

# Faceted filter system for product lists

## Goal

Ship a generic, reusable **faceted filter system** for product list views on the public site. First consumer is [ss.com-cars-integration](ss-com-cars-integration.md); the same component powers the existing `/products` route + future Inventory list views.

Capabilities:

- **Multi-select** for taxonomy facets (make, model, category) — cascading where appropriate (Make → Model)
- **Range sliders with min/max text inputs** for numeric facets (price, mileage, year)
- **Single-select** for enum facets (fuel, transmission, body, drive)
- **Live result counts** per facet option; grey-out zero-result options
- **Pinned applied-filter chips** at top with one-click removal + "Clear all"
- **Saved searches + alerts** — email or in-app when new matches land
- **Layout:** persistent left sidebar (desktop) / full-screen drawer with sticky "Show X results" CTA (mobile)
- **Apply mode:** real-time on desktop / deferred-apply on mobile (reduces page reflow on touch)
- **URL-driven** — every filter state is in the URL (shareable, back-button safe)

## Why now

- ss.com's #1 user complaint is no multi-select make/model. Shipping this gives us an instant UX win on the cars vertical.
- Generic shape (not car-specific) means subsequent verticals (real estate, jobs if we ever expand) drop in via facet config.
- The existing `/products` route has bare-minimum filtering today; promoting it to faceted gives our generic commerce surface a real conversion lift.

## Design

### Facet config shape

```ts
// shared/types/IFacetConfig.ts
export type FacetKind = 'multi-select' | 'single-select' | 'range' | 'boolean';

export interface IFacetConfig {
    /** URL key, e.g. 'make', 'price', 'fuel'. */
    key: string;
    /** Operator-facing label. */
    label: string;
    kind: FacetKind;
    /** Where to read values from for taxonomy facets. */
    source?: {
        kind: 'static' | 'collection' | 'attribute-distinct';
        // 'static': inline values; 'collection': read from a Mongo collection; 'attribute-distinct': aggregate distinct attribute values
        collection?: string;
        attribute?: string;
        values?: Array<{value: string; label: string}>;
    };
    /** For range facets — bounds + step. */
    range?: {min: number; max: number; step: number; unit?: string};
    /** Optional facet-dependency. e.g. Model depends on Make. */
    dependsOn?: string;
    /** Display priority — lower = earlier in sidebar. */
    order: number;
    /** Hide when 0 results match it (clutter reduction). */
    hideEmpty?: boolean;
    /** Mobile-first: show in the priority-collapsed view? */
    priorityMobile?: boolean;
}

export interface IProductListConfig {
    /** Used by route params: `/products`, `/cars`. */
    slug: string;
    title: string;
    facets: IFacetConfig[];
    /** Default sort + alternatives. */
    sorts: Array<{key: string; label: string; mongo: Record<string, 1 | -1>}>;
    /** Filter against IProduct.source. */
    sourceFilter?: 'manual' | 'warehouse' | Array<'manual' | 'warehouse'>;
}
```

### Facet kind: multi-select with cascading

```ts
// Cars cascade: select Make → Model list filters to that make's models
{key: 'make', label: 'Make', kind: 'multi-select', source: {kind: 'attribute-distinct', attribute: 'make'}, order: 10}
{key: 'model', label: 'Model', kind: 'multi-select', source: {kind: 'attribute-distinct', attribute: 'model'}, dependsOn: 'make', order: 11}
```

When the user picks Make = Audi + BMW, the Model facet refetches its distinct values filtered to those makes. The filter URL grows: `?make=audi,bmw&model=a4,a6,x3`.

### Facet kind: range

```ts
{key: 'price', label: 'Price', kind: 'range', range: {min: 0, max: 100_000, step: 100, unit: '€'}, order: 1}
{key: 'mileage', label: 'Mileage', kind: 'range', range: {min: 0, max: 500_000, step: 5_000, unit: 'km'}, order: 4}
{key: 'year', label: 'Year', kind: 'range', range: {min: 1990, max: 2026, step: 1}, order: 3}
```

UI: dual-thumb slider + paired min/max text inputs. Text inputs are the source of truth (data entry); slider drives them. URL: `?price=2000-25000&year=2015-2026`.

### Live result counts

Counts are computed server-side per facet via Mongo aggregation. The list query returns:

```ts
{
    items: IProduct[],
    total: number,
    facetCounts: Record<string, Record<string, number>>,  // {make: {audi: 142, bmw: 87, ...}, fuel: {petrol: 320, diesel: 410, ...}}
}
```

Greyed-out (zero-count) options stay visible but unclickable — Baymard finding: hiding them entirely confuses users who expect the option list to be stable.

### Pinned chips + Clear all

Chip bar above the result grid (sticky on desktop, fixed below the count-CTA on mobile):

```
[ Make: Audi × ] [ Make: BMW × ] [ Price: €2k-€25k × ] [ Year: 2015-2026 × ]  Clear all
```

One-click removal updates URL + refetches.

### Saved searches + alerts

Logged-in users (post [client-signup-and-anonymous-checkout](client-signup-and-anonymous-checkout.md)) can save the current filter state:

```ts
// shared/types/ISavedSearch.ts
interface ISavedSearch {
    id: string;
    customerId: string;
    listSlug: string;       // 'cars', 'products', …
    title: string;          // user-given
    filterUrl: string;      // canonical query string
    alertChannel: 'email' | 'in-app' | 'none';
    alertCadence: 'instant' | 'daily-digest' | 'weekly-digest';
    createdAt: string;
    lastNotifiedAt?: string;
}
```

Background worker (reuses existing scheduled-task infrastructure if present, else a new Releases-style scheduled run) executes each saved search at its cadence, compares result IDs against `lastNotifiedAt`'s, emails delta.

### Mobile layout

- Filter trigger button — fixed bottom-left, badge counter ("3 filters")
- Tap → full-screen drawer slides up
- Drawer header: "Filters" + close (×) + "Reset"
- Drawer body: collapsed-by-default facet groups (tap to expand) ordered by `priorityMobile === true` first
- Drawer footer: sticky "Show X results" button — applies filters + closes drawer

Real-time filter on desktop, deferred-apply (only on "Show X results") on mobile.

### URL canonicalisation

URL params are sorted alphabetically and value-sorted within multi-selects. Same filter state = same URL = same cache key. SEO benefit: filtered list pages have stable canonical URLs.

### Component shape

```
ui/client/features/ProductList/
├── ProductList.tsx              # top-level page render
├── ProductList.scss
├── FacetSidebar.tsx             # desktop sidebar
├── FacetDrawer.tsx              # mobile drawer
├── FacetGroup.tsx               # one facet's UI (dispatch by kind)
├── facets/
│   ├── MultiSelectFacet.tsx
│   ├── SingleSelectFacet.tsx
│   ├── RangeFacet.tsx
│   └── BooleanFacet.tsx
├── ChipBar.tsx                  # pinned applied filters
├── ResultGrid.tsx               # card grid
├── SavedSearchPrompt.tsx        # "Save this search" CTA
├── useFilterState.ts            # URL ↔ state hook
└── index.ts
```

## Files to touch

- `shared/types/IFacetConfig.ts` (new)
- `shared/types/ISavedSearch.ts` (new)
- `services/features/ProductList/ProductListService.ts` (new — facet aggregation + count query)
- `services/features/ProductList/ProductListServiceLoader.ts` (new)
- `services/features/SavedSearch/SavedSearchService.ts` (new) + worker
- `ui/client/features/ProductList/` (new directory — see component shape)
- `ui/client/pages/products/index.tsx` — switch to new component (replacing existing thin list)
- `ui/client/pages/cars/index.tsx` (new) — config + render
- `services/features/Mcp/tools/savedSearch.ts` — MCP coverage
- Tests: service-level facet-count aggregation; e2e (filter cars by make+price range → result count matches → save search → assert in account)

## Starter code

URL ↔ state hook:

```ts
// ui/client/features/ProductList/useFilterState.ts
export function useFilterState(facets: IFacetConfig[]) {
    const router = useRouter();
    const state: Record<string, unknown> = useMemo(() => parseUrl(router.query, facets), [router.query, facets]);

    function setFacet(key: string, value: unknown) {
        const next = serializeUrl({...state, [key]: value}, facets);
        router.replace({pathname: router.pathname, query: next}, undefined, {shallow: true});
    }

    function clearAll() {
        router.replace({pathname: router.pathname, query: {}}, undefined, {shallow: true});
    }

    return {state, setFacet, clearAll};
}
```

Server-side facet-count aggregation (Mongo $facet pipeline):

```ts
async function listWithFacets(filter: Record<string, unknown>, facets: IFacetConfig[], page: number, perPage: number) {
    const pipeline = [
        {$match: composeMatchStage(filter)},
        {$facet: {
            items: [{$sort: {publishedAt: -1}}, {$skip: page * perPage}, {$limit: perPage}],
            total: [{$count: 'count'}],
            ...Object.fromEntries(facets
                .filter((f) => f.kind === 'multi-select' || f.kind === 'single-select')
                .map((f) => [`facet_${f.key}`, [
                    {$group: {_id: `$attributes.${f.key}`, count: {$sum: 1}}},
                    {$project: {value: '$_id', count: 1, _id: 0}},
                ]])),
        }},
    ];
    const [result] = await productsDB.aggregate(pipeline).toArray();
    return {
        items: result.items,
        total: result.total[0]?.count ?? 0,
        facetCounts: composeFacetCounts(result, facets),
    };
}
```

## Acceptance

1. Cars list at `/cars` renders with cascading make/model multi-select + price/mileage/year range sliders + fuel/transmission/body single-selects + region multi-select
2. Live counts on every facet option; zero-count options greyed but visible
3. Pinned chips at top + "Clear all" works
4. URL reflects every filter; back-button restores state; copy-paste URL reproduces results
5. Mobile drawer with deferred-apply + "Show X results" sticky CTA
6. Logged-in customer can save a search + name it + pick alert cadence
7. Background worker emails delta on schedule (verified by spec mocking `nowIso()`)
8. Generic `/products` route uses the same component with a different facet config (proves reusability)
9. E2E: filter cars by make=Audi + price 2k-25k → count matches → save search → verify in `/account/searches` → trigger alert via mocked time advance

## Effort

**L · ~6-8 hours AI.**

- Facet config schema + service aggregation: ~1.5 hour
- URL state hook + composition: ~1 hour
- Component shape (sidebar + drawer + 4 facet kinds + chips + result grid): ~3 hours
- Saved search + worker: ~1 hour
- Per-route config + cars page: ~30 min
- Tests + e2e: ~1 hour

## Dependencies

- [client-signup-and-anonymous-checkout](client-signup-and-anonymous-checkout.md) — saved searches require customer auth
- [ss-com-cars-integration](ss-com-cars-integration.md) — first real-data consumer; can land slightly ahead with seeded fixtures
- Existing `IProduct.attributes` map — the facet system reads from it

## Open questions

- **[OPERATOR DECISION]** Mobile apply mode — deferred (current spec) or real-time? Deferred reduces reflow but breaks the "see what changes as you tap" feel. Recommend: deferred default + a feature flag to swap.

## Out of scope

- AI-suggested filters ("show me family-friendly cars under €10k") — separate item
- Map view + radius search — separate item once Latvia geocoding is wired
- Faceted filters on the admin product list (admin uses simpler table filters today)
