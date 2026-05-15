---
name: pc-parts-dropshipping-integration
description: Replace the previously-spec'd ss.com cars vertical with a PC-parts dropshipping integration against an EU/UK distributor (TD SYNNEX, Ingram Micro, or Asbis). Operator holds no inventory — every order placed on the storefront is forwarded to the distributor who ships direct to the customer. New `IDropshipDistributorAdapter` interface extending the existing W7b `IWarehouseAdapter` with placeOrder + getOrderStatus + getReturnPolicy. First adapter ships against TD SYNNEX StreamOne (largest pan-EU+UK reach). Storefront surface is the existing `Product` content module + composable category pages from products-as-composable-page; checkout flow is the existing system pages from checkout-as-composable-page — the dropship integration just wires `OrderService.finalize` to forward to the distributor instead of fulfilling locally.
---

# PC-parts dropshipping integration

## Goal

Storefront sells PC parts (CPUs, GPUs, motherboards, RAM, SSDs, cases, peripherals) without holding inventory. Every customer order forwards to a distributor who ships direct.

- **Catalogue** ingested from distributor via existing W7b adapter pattern; products auto-populate `/products/<category>/<subcategory>/...` via products-as-composable-page
- **Order forwarding** at `OrderService.finalize` calls distributor `placeOrder()` → distributor allocates stock + ships
- **Status tracking** polls or webhook-receives distributor order updates → updates `IOrder.fulfillmentStatus` → triggers receipt + shipping emails via W6a templates
- **Operator margin** layered on top of distributor wholesale price via per-product or per-category markup config
- **VAT regime** uses existing W8g `VatRegimeService` (EU OSS / UK 20% / reverse-charge B2B) — same path the rest of the storefront uses

This is the third commerce vertical (after auth-split + checkout-customization). Replaces the previously-spec'd ss.com cars integration which has been removed — ss.com has no API, no partner program, and cars are wrong-vertical for dropshipping.

## Why now

- **Existing pieces fit perfectly.** W7b shipped the `IWarehouseAdapter` system + cascade-delete machinery + sync worker. Phase 1.C shipped products-as-composable-page (the category tree this populates). Phase 1.B + 1.D shipped the Product module + checkout system pages. W8g shipped multi-currency + VAT. W6a shipped receipt emails. Everything needed is already in place — this jump just wires a new adapter.
- **PC parts is a known-margin market.** Wholesale margins are tight (3-8% before tax) but operator can layer service / config / build help on top. The platform's strength is composable category pages + faceted filter (W6b) + B2B customer profile (Phase 1.E) — all of which fit PC parts perfectly.
- **No inventory risk.** Operator doesn't pre-buy stock. Distributor allocates at order time. If distributor is out of stock, order is rejected at place-time before customer's card is charged.
- **EU/UK only.** Distributors cover the EU single market + UK. No US / APAC complications. VAT regime (W8g) handles cross-border B2C-EU correctly. UK is its own VAT regime in the static table.
- **Real product fit.** Operator's target market is technical buyers who want curated builds + spec advice + the composable Product Detail pages (Phase 1.F templates) — not the unstructured catalogue of Amazon. Differentiation by content depth, not price.

## Design

### Distributor choice — three viable options

Operator picks one for the first integration. Adapter is interchangeable post-launch.

| Distributor | Coverage | API | Partner agreement | Notes |
|---|---|---|---|---|
| **TD SYNNEX** (StreamOne Ion) — **recommended first** | All EU + UK | REST + OData | Yes (operator must open partner account; typically 1-2 week setup) | Largest pan-EU reach. Full dropshipping support. Best brand catalogue depth. Docs at `developers.streamonecloud.com`. |
| **Ingram Micro Xvantage** | All EU + UK | REST + GraphQL | Yes | Similar scale; comparable catalogue. Xvantage Marketplace API. |
| **Asbis** | Central + Eastern EU (LV/PL/CZ/SK/HU) + selective UK | REST + SOAP | Yes | Smaller but operator-friendly (faster onboarding). Native Latvian presence — relevant if operator is LV-based. |

**Out of scope:**
- AliExpress dropshipping (quality / customs / VAT issues + slow shipping; wrong for PC parts where speed + warranty matter)
- Spocket (general dropshipping aggregator; PC parts shallow)
- Direct manufacturer relationships (Intel, AMD, etc. — they sell through distributors, not direct to operators at this scale)

### Adapter contract

New interface in `services/features/Inventory/adapters/IDropshipDistributorAdapter.ts`:

```ts
import type {IWarehouseAdapter} from './IWarehouseAdapter';

export interface IDropshipDistributorAdapter extends IWarehouseAdapter {
    /** Forward an order to the distributor. Distributor allocates stock,
     *  charges the operator's wholesale account, ships direct to the
     *  customer's address. */
    placeOrder(input: PlaceDropshipOrderInput): Promise<PlaceDropshipOrderResult>;

    /** Poll for status update on a forwarded order. Returns
     *  fulfillmentStatus + tracking when shipped. Operator's scheduled
     *  job calls this periodically (or webhook delivers — adapter-specific). */
    getOrderStatus(distributorOrderId: string): Promise<DropshipOrderStatus>;

    /** Per-product return policy + restocking-fee schedule.
     *  Cached on first hit; varies by distributor + product category. */
    getReturnPolicy(productId: string): Promise<DropshipReturnPolicy>;

    /** Wholesale price quote for one product + qty, exclusive of customer
     *  shipping. Operator markup layered on top by OrderService. */
    quoteWholesale(productId: string, qty: number): Promise<WholesaleQuote>;
}

export interface PlaceDropshipOrderInput {
    operatorOrderId: string;          // for distributor-side reference
    items: Array<{productId: string; qty: number}>;
    shipTo: IAddress;                 // shared/types/IUser.IAddress
    customerEmail: string;            // distributor sends shipping notification direct
    customerPhone?: string;
    notes?: string;                   // operator passes through; some distributors echo on packing slip
}

export interface PlaceDropshipOrderResult {
    ok: boolean;
    distributorOrderId?: string;      // operator persists this on IOrder
    rejectedItems?: Array<{productId: string; reason: 'out-of-stock' | 'not-shippable' | 'price-changed' | 'other'; detail?: string}>;
    quotedTotal?: MoneyAmount;        // wholesale + distributor shipping
    estimatedShipDate?: string;
    error?: string;
}

export type DropshipOrderStatus =
    | {status: 'pending-allocation'}
    | {status: 'allocated', estimatedShipDate: string}
    | {status: 'shipped', trackingNumber: string, carrier: string, shippedAt: string}
    | {status: 'delivered', deliveredAt: string}
    | {status: 'rejected' | 'cancelled', reason: string}
    | {status: 'unknown'};

export interface DropshipReturnPolicy {
    windowDays: number;              // typical 14 (EU consumer law) or 30
    restockingFeePct?: number;       // some categories have fees
    excludedReasons: string[];       // e.g. ['software-keys', 'opened-thermal-paste']
    returnAddress: IAddress;
}

export interface WholesaleQuote {
    productId: string;
    qty: number;
    unitWholesale: MoneyAmount;
    lineTotal: MoneyAmount;
    distributorShippingEstimate?: MoneyAmount;
    quotedAt: Date;                   // wholesale quotes typically valid 24h
    validUntil: Date;
}
```

Each adapter implementation lives under `services/features/Inventory/adapters/<distributor>/`:

- `services/features/Inventory/adapters/tdSynnex/TdSynnexAdapter.ts`
- `services/features/Inventory/adapters/ingramMicro/IngramMicroAdapter.ts`
- `services/features/Inventory/adapters/asbis/AsbisAdapter.ts`

Each one bridges the distributor's API quirks to the standard interface. Adapter is selected at runtime via `commerce.dropshipDistributor` flag.

### Operator-facing pricing model

Operator sets per-product or per-category markup. `IProductPricing` extends:

```ts
interface IProductPricing {
    // ... existing W8g fields (prices, baseCurrency, tax)
    wholesale?: MoneyAmount;             // pulled from distributor; refreshed on sync
    markupPct?: number;                  // operator override, default falls through category
    markupAbsolute?: MoneyAmount;        // alternative: flat margin override
    minMarginPct?: number;               // floor — never sell below this margin
}
```

Display price computed at sync time: `displayPrice = wholesale × (1 + max(markupPct, minMarginPct))` or `wholesale + markupAbsolute`. Markup never falls below `minMarginPct` (operator safety net for distributor price hikes between syncs).

Per-category default markups configurable in admin (`/admin/commerce/dropship/markups`):

```
CPU             → 5%
GPU             → 8%
Motherboard     → 6%
RAM             → 4%
SSD             → 5%
Case            → 12%
Peripherals     → 15%
Accessories     → 20%
```

Operator can override per-product via the Phase 1.F template picker / product edit form.

### Order flow

1. Customer adds items → cart (Phase 1.B `useCart`)
2. Customer checks out → checkout system pages (Phase 1.D)
3. Customer pays (Stripe via W8g; or BankTransfer / CashOnDelivery via Phase 1.B-c — but CoD doesn't make sense for dropshipping; admin pane should disable CoD when `commerce.dropshipDistributor` is set)
4. `OrderService.finalize()` extension: when order contains dropship-sourced products (`IProduct.source === 'warehouse'` with `IProduct.warehouseAdapter === 'tdSynnex' | 'ingramMicro' | 'asbis'`), call `adapter.placeOrder({...})`
5. If `placeOrder` returns `ok: true` → order moves to `pending-shipment`, customer receipt email sent
6. If `placeOrder` returns `ok: false` with `rejectedItems` → order moves to `partial-rejection` or `cancelled`; refund initiated; customer email explains which items couldn't be sourced
7. Operator-side cron polls `adapter.getOrderStatus()` for each `pending-shipment` order; status changes trigger lifecycle events (`shipped` → tracking email; `delivered` → review-request email after 7 days; `cancelled` → refund flow)
8. Optional: distributor webhook delivers status updates (adapter declares webhook capability + signature verification)

### Operator-side scheduled jobs

- **`DropshipPriceSyncWorker`** — hourly. Refreshes `IProduct.pricing.wholesale` from distributor's catalogue. Marks product `out-of-stock` when distributor reports zero. Persists.
- **`DropshipOrderPollingWorker`** — every 10 min. Iterates `IOrder.fulfillmentStatus === 'pending-shipment' | 'allocated'`, calls `adapter.getOrderStatus`. Updates IOrder + emits events.
- **`DropshipCatalogueSyncWorker`** — reuses Phase 1.C `WarehousePageSyncWorker` cron; new adapters plug into the same machinery, no new worker needed.

### `commerce.dropship.*` flags

Add via `defineFlag()` (Phase 0c pattern):

- `commerce.dropship.enabled` (bool, default false) — master switch
- `commerce.dropship.adapter` (`'tdSynnex' | 'ingramMicro' | 'asbis' | 'none'`, default `'none'`)
- `commerce.dropship.priceSyncIntervalMinutes` (number, default 60)
- `commerce.dropship.orderPollIntervalMinutes` (number, default 10)
- `commerce.dropship.minMarginPct` (number, default 0.03 — 3% floor)
- `commerce.dropship.holdOrderOnPriceMismatch` (bool, default true) — when distributor's `placeOrder` returns a different `quotedTotal` from cart total, hold order for operator review instead of charging

### MCP coverage

`services/features/Mcp/tools/dropship.ts` (NEW):

- `dropship.config.get / set` — flag wrappers
- `dropship.adapter.list` — enumerate available adapters + env-config status
- `dropship.product.quote { productId, qty }` — manual wholesale quote
- `dropship.order.placeManual { items, shipTo, ... }` — operator-initiated dropship order (for support call-ins)
- `dropship.order.status { orderId }` — fetch current status from distributor
- `dropship.order.poll` — manually trigger the polling worker (operator debug)
- `dropship.priceSync.run { productIds? }` — manually trigger price sync
- `dropship.markup.list / set` — per-category markup CRUD
- `dropship.returnPolicy.get { productId }` — fetch policy

Register `DROPSHIP_TOOLS` in `services/features/Mcp/tools/index.ts`.

### Admin panes

- `ui/admin/features/Commerce/DropshipSettingsPanel.tsx` — master switch + adapter picker + interval config + min margin
- `ui/admin/features/Commerce/DropshipMarkupsPanel.tsx` — per-category markup table (drag-reorder optional)
- `ui/admin/features/Commerce/DropshipOrdersPanel.tsx` — operator observability — orders with their distributor-side status + manual poll + rejected-items detail
- `ui/admin/features/Commerce/DropshipAdapterStatusPanel.tsx` — adapter health: last sync, last error, distributor account credentials configured / missing

All VM4 (no useState). Sonner notifications. testids on every interactive.

### Storefront surface

No new modules. The integration consumes:
- `Product` module (mode=featured/grid/etc) — Phase 1.B
- `ProductDetailHero` + `ProductSpecTable` + `ProductDescription` + `ProductRelated` — Phase 1.C
- `WarrantyInfo` + `DownloadablePdf` (spec sheets) — Phase 1.F
- Category pages auto-generated by `WarehousePageSyncWorker` — Phase 1.C
- Faceted filter — Phase W6b
- Checkout system pages — Phase 1.D
- Currency switcher + VAT badge — Phase W8g

### Required-account UX

For a dropshipping commerce site, operator may want to force account creation at checkout (returns / warranty / order history are smoother with accounts). Phase 1.A `auth.clientLoginEnabled` + Phase 1.E `customerType` already support this. Operator just flips `commerce.checkout.requireAccount: true` (Phase 1.B-c).

### B2B path (Phase 1.E company-type)

Phase 1.E `customerType === 'company'` customers get:
- VAT reverse-charge at checkout (W8g)
- Net-30 payment terms (operator decision; not in this jump — flagged for follow-up if a B2B customer asks)
- Bulk-discount tier overrides (operator decision)

For B2B customers, distributors often want a separate purchase order flow with different SLAs. Out of scope for this jump — ship B2C first; B2B extension is a follow-up.

### Customer support tools

- `dropship.order.placeManual` MCP — operator support agent places an order on behalf of a customer over the phone
- Admin Orders pane gains "Re-poll distributor status" button per order
- Admin Orders pane shows distributor's order ID + tracking link inline (link out to distributor's tracking page when no carrier deep link is available)

### Environment variables

`.env.example` extension:

```
# Dropship distributor — operator picks one + drops credentials
COMMERCE_DROPSHIP_ENABLED=false
COMMERCE_DROPSHIP_ADAPTER=tdSynnex                # tdSynnex | ingramMicro | asbis

# TD SYNNEX StreamOne Ion
TD_SYNNEX_API_BASE=https://api.streamonecloud.com
TD_SYNNEX_CLIENT_ID=
TD_SYNNEX_CLIENT_SECRET=
TD_SYNNEX_RESELLER_ID=                            # operator's partner reseller code

# Ingram Micro Xvantage
INGRAM_API_BASE=https://api.ingrammicro.com
INGRAM_CLIENT_ID=
INGRAM_CLIENT_SECRET=
INGRAM_CUSTOMER_NUMBER=

# Asbis B2B
ASBIS_API_BASE=https://b2b.asbis.com/api
ASBIS_USERNAME=
ASBIS_PASSWORD=
ASBIS_COUNTRY=LV
```

Operator drops creds post-merge; adapter `isConfigured()` returns false when env unset → admin pane shows "Configure distributor credentials" prompt with link to runbook.

## Files to touch

### New files

- `services/features/Inventory/adapters/IDropshipDistributorAdapter.ts`
- `services/features/Inventory/adapters/tdSynnex/{TdSynnexAdapter,TdSynnexClient,TdSynnexNormaliser}.ts` (primary first-ship)
- `services/features/Inventory/adapters/ingramMicro/{IngramMicroAdapter,IngramMicroClient,IngramMicroNormaliser}.ts` (stub structure; flesh on demand)
- `services/features/Inventory/adapters/asbis/{AsbisAdapter,AsbisClient,AsbisNormaliser}.ts` (stub structure)
- `services/features/Inventory/adapters/_fixtures/tdSynnex-sample.json` (replaces the deleted ss.com fixture)
- `services/features/Dropship/DropshipPriceSyncWorker.ts`
- `services/features/Dropship/DropshipOrderPollingWorker.ts`
- `services/features/Dropship/DropshipMarkupService.ts`
- `services/features/Dropship/dropshipFlags.ts` — `defineFlag()` registrations
- `services/features/Dropship/feature.manifest.ts` + `DropshipFeatureLoader.ts`
- `services/features/Mcp/tools/dropship.ts` — 9 new tools
- `ui/admin/features/Commerce/{DropshipSettingsPanel,DropshipMarkupsPanel,DropshipOrdersPanel,DropshipAdapterStatusPanel}.tsx` + ViewModels + AdminUILoaders
- `tests/e2e/storefront/dropship-order-flow.spec.ts`
- `tests/e2e/admin/dropship-settings.spec.ts`
- `docs/runbooks/dropship-tdSynnex-setup.md` — operator runbook: partner account, OAuth client setup, sandbox testing, going live, troubleshooting
- `docs/runbooks/dropship-distributor-comparison.md` — operator decision aid (which distributor to pick)
- `docs/architecture/dropship-integration.md` — design doc

### Modified files

- `shared/types/IProduct.ts` — add `warehouseAdapter?: 'tdSynnex' | 'ingramMicro' | 'asbis' | 'manual'` (extends existing `source`)
- `shared/types/IPricing.ts` (or `IProduct.IProductPricing`) — add `wholesale`, `markupPct`, `markupAbsolute`, `minMarginPct`
- `shared/types/IOrder.ts` — add `dropshipOrderId?`, `dropshipAdapterId?`, `dropshipFulfillmentStatus?`, `distributorTracking?`
- `services/features/Orders/OrderService.ts` — extend `finalize()` to route dropship-sourced orders through the active adapter
- `services/features/Inventory/InventoryService.ts` — `IProduct.source === 'warehouse'` paths now consult adapter
- `services/features/Inventory/adapters/index.ts` — register new adapter factory
- `services/features/Commerce/commerceFlags.ts` — append dropship flag registrations (defineFlag — Phase 0c)
- `services/features/Mcp/tools/index.ts` — register `DROPSHIP_TOOLS`
- `ui/admin/lib/loaders/adminUILoaderRegistry.ts` — register 4 new panes
- `services/infra/featureRegistry.generated.ts` — codegen
- `.env.example` — add distributor env vars

### Deleted (replacing ss.com cars)

- `services/features/Inventory/adapters/SsComCarsAdapter.ts` (if still present)
- `services/features/Inventory/adapters/_fixtures/ss-com-sample.json`
- `ui/admin/features/Cars/` (entire folder if shipped during ss.com era)
- `ui/client/modules/Cars/` (car-specific modules: `CarListingCard`, `CarPhotoGallery`, `CarSpecTable`, `CarReservationCta`, `CarComparisonTable`, `CarFinanceEstimator`, `CarVehicleDetailPage`, `VatBadge`)

**Wait — `VatBadge` and some Car* modules are used by other surfaces (faceted filter system, gdpr work).** Audit each module's call sites before deleting; preserve VatBadge (cross-vertical) + repurpose Car* modules to generic Product* equivalents where possible. The cars-vertical modules that don't have generic equivalents (CarFinanceEstimator, CarReservationCta) can be deleted outright since dropshipping doesn't have a reservation flow.

`docs/roadmap/storefront/ss-com-cars-integration.md` — delete.

## Acceptance

1. `IDropshipDistributorAdapter` interface defined; one concrete adapter (TD SYNNEX) implemented + tested against fixtures
2. `commerce.dropship.enabled` flag default false; flipping it to true with a configured adapter starts price-sync + order-polling workers
3. Catalogue sync populates `/products/<category>/...` page tree via Phase 1.C machinery (no new code path; just plugs into existing `WarehousePageSyncWorker`)
4. Customer checkout end-to-end against fixture data — order finalize forwards to fake adapter, status updates lifecycle, receipt + shipping emails fire via W6a templates
5. Markup applies on display — `displayPrice = wholesale × (1 + markupPct)`; never below `minMarginPct` floor
6. Out-of-stock at distributor → order rejected before card charge (no partial dispatch + refund nightmare)
7. Stripe Tax via W8g `StripeTaxService` invoked correctly for UK / EU-OSS / reverse-charge B2B
8. Admin pane shows real adapter status (connected / not configured / last sync error)
9. 9 MCP tools callable; `dropship.config.get` + `.set` round-trip
10. 2 e2e specs green
11. Operator runbook for TD SYNNEX setup is complete and walks through: open partner account → API client → sandbox → live cutover → troubleshooting
12. Architecture doc + dropship-distributor-comparison runbook published
13. ss.com cars spec deleted; cars-vertical modules audited + deleted/migrated

## Effort

**XL · ~5-7 days AI** + operator partner-onboarding wall-clock (1-2 weeks for TD SYNNEX partner agreement).

Recommended sub-jumps per §13:

- **Sub-jump A** — Interface + TD SYNNEX adapter + fixture-driven testing (~2 days AI)
- **Sub-jump B** — Order flow integration in `OrderService.finalize` + workers + lifecycle events (~1.5 days AI)
- **Sub-jump C** — Operator markup config + admin panes + MCP tools (~1.5 days AI)
- **Sub-jump D** — ss.com cleanup + Car* module audit + delete/migrate (~0.5 day AI)
- **Sub-jump E** — Ingram Micro + Asbis adapters (parallel to A; each ~1.5 days AI; ship operator pick first, others land later on demand)

## Dependencies

**Hard (already shipped):**
- W7b `IWarehouseAdapter` system + sync worker
- Phase 1.B `Product` module + cart
- Phase 1.C products-as-composable-page (the category page tree)
- Phase 1.D checkout-as-composable-page (the checkout flow)
- Phase 1.F `IProductTemplate` library (so operator can pick a B2B-spec-sheet template per product)
- W6a receipt + transactional emails
- W8g multi-currency + tax + VIES
- Phase 1.B-c payment provider toggles (Stripe primary; BankTransfer for B2B)
- Phase 1.E `customerType === 'company'` for B2B path

**Soft:**
- Phase 1.A `auth.clientLoginEnabled` — when on, customer accounts persist orders + warranty (better UX for returns)
- W6b faceted filter system (filter by brand / spec / price)
- W8c email deliverability hardening (DKIM / SPF — needed for distributor notification emails to land)

## Operator post-merge ops (REQUIRED before going live)

1. **Open TD SYNNEX (or Ingram / Asbis) partner account** — typically 1-2 weeks lead time. Operator's business needs registration number, VAT ID, bank reference, signed reseller agreement.
2. **Generate OAuth client credentials in distributor's developer portal** — drop into `.env`.
3. **Configure shipping origin** in distributor portal so shipments go from their warehouse to customer with operator's branding on the packing slip (if distributor supports white-label).
4. **Smoke-test in sandbox** — distributor provides a sandbox environment; run a fake order through; confirm shipping address propagates correctly, tracking webhooks deliver, returns flow works.
5. **Cutover** — flip `COMMERCE_DROPSHIP_ENABLED=true`, narrow the catalogue to a curated initial subset (~100 products) before opening firehose-mode sync.

## Out of scope

- Multi-distributor routing (one product offered by multiple distributors, pick cheapest at order time) — separate jump if operator's margin pressure justifies the complexity
- B2B credit terms / net-30 payments — separate jump
- Custom PC builds / configurator (compatibility checker for CPU + mobo + RAM) — separate large jump
- White-label packaging from distributor (some distributors charge extra for this) — operator decision
- Returns automation (return-merchandise-authorization auto-issue) — operator-facing manual flow initially; automate later
- Real-time inventory sync (push from distributor) — polling is sufficient at v1 scale; webhook-driven sync is a follow-up if operator's order volume justifies it
- Multi-currency wholesale pricing — adapters typically quote in EUR or GBP only; operator's storefront-side multi-currency display still works via W8g FX

## Visual reference

### Customer product detail page

```
┌──────────────────────────────────────────────────────────┐
│  AMD Ryzen 9 7950X — 16-core / 32-thread                │
│  ★★★★★ (124 reviews)                                    │
│  ┌──────────┐    €599  (≈ £519 GBP)                     │
│  │  Image   │    [VAT included for EU buyers]            │
│  │          │    [In stock at distributor — ships 1-2 d] │
│  │          │                                            │
│  │          │    [ Add to cart ]   [ Add to wishlist ]   │
│  └──────────┘                                            │
├──────────────────────────────────────────────────────────┤
│  SPECIFICATIONS                                          │
│  Cores         16                                        │
│  Threads       32                                        │
│  Base clock    4.5 GHz                                   │
│  Boost clock   5.7 GHz                                   │
│  TDP           170 W                                     │
│  Socket        AM5                                       │
│  Architecture  Zen 4                                     │
├──────────────────────────────────────────────────────────┤
│  Description ...                                         │
│  Compatibility hint: needs AM5 motherboard + DDR5 RAM    │
├──────────────────────────────────────────────────────────┤
│  Related: Compatible motherboards, RAM, cooling          │
└──────────────────────────────────────────────────────────┘
```

### Admin dropship orders pane

```
┌────────────────────────────────────────────────────────────────┐
│  Dropship Orders                                               │
│  [ Refresh status all ]                                        │
├─────────┬────────────┬──────────────┬──────────┬───────────────┤
│ Order # │ Customer   │ Distributor# │ Status   │ Tracking      │
├─────────┼────────────┼──────────────┼──────────┼───────────────┤
│ #1234   │ J. Smith   │ TDS-99876    │ Shipped  │ DHL ...       │
│ #1235   │ A. Bērzkalns│ TDS-99877   │ Pending  │ —             │
│ #1236   │ M. Müller  │ TDS-99878    │ Rejected │ Out-of-stock  │
└─────────┴────────────┴──────────────┴──────────┴───────────────┘
```
