---
name: pc-parts-dropshipping-integration
description: Replace the previously-spec'd ss.com cars vertical with a PC-parts dropshipping integration against an EU/UK distributor (TD SYNNEX, Ingram Micro, or Asbis). Operator holds no inventory — every order placed on the storefront is forwarded to the distributor who ships direct to the customer. New `IDropshipDistributorAdapter` interface extending the existing W7b `IWarehouseAdapter` with placeOrder + getOrderStatus + getReturnPolicy. First adapter ships against TD SYNNEX StreamOne (largest pan-EU+UK reach). Storefront surface is the existing `Product` content module + composable category pages from products-as-composable-page; checkout flow is the existing system pages from checkout-as-composable-page — the dropship integration just wires `OrderService.finalize` to forward to the distributor instead of fulfilling locally.
---

# PC-parts dropshipping integration

> **Decision Record — 2026-05-16 EU distributor research pivot**
>
> Original spec recommended **TD SYNNEX StreamOne** as the first impl
> because of pan-EU reach + brand depth. Two web-research passes this
> session ([PC parts](#) + [robotics/AI hardware](#)) showed:
>
> 1. **Every "tier-1" distributor (TD SYNNEX, Ingram Micro, Asbis) is
>    indie-hostile.** 2–4 week onboarding, business-verification gauntlet,
>    minimum-volume commitments, and physical-address checks that exclude
>    one-person operators. The TD-SYNNEX scaffold is real-but-dormant —
>    it sits in `services/features/Dropship/TdSynnexStreamOne.ts` waiting
>    on a partner account that may take 1–2 weeks at best, longer
>    realistically.
>
> 2. **TME (Transfer Multisort Elektronik, Łódź PL) is the indie path.**
>    Self-service developer signup (https://developers.tme.eu/en/signup),
>    free public REST API + GitHub SDKs, lightweight B2B trade account
>    (days not weeks with valid VAT + business reg), EU-wide coverage,
>    ~1M+ SKUs. Critically, TME's catalogue is **broader than PC parts**
>    — it covers motors, sensors, MCUs, Pi/Jetson dev kits, batteries,
>    connectors, robotics components, and AI-edge accelerators (Coral,
>    Jetson dev kits, RealSense via Mouser-rebranded carriers). This
>    means the same adapter unlocks three verticals: PC parts, robotics
>    kits, AI/edge hardware.
>
> 3. **Margin reality is grimmer than the original spec assumed.** Pure
>    component-level dropshipping in the EU is 3–5% gross margin after
>    shipping + payment fees — not the 5–15% the spec banked on. Indie
>    EU PC shops survive by stock-holding (Mindfactory/Alternate-style)
>    or by adding kitting + integration + ROS support on top. Pure
>    SKU arbitrage is a treadmill in this market regardless of vertical.
>    See `docs/roadmap/storefront/first-class-themes.md` — the saas-landing
>    + commerce themes are designed for a configured-kit product page,
>    not a thousand-SKU price war.
>
> **First-impl pivot:** TME goes first. TD SYNNEX scaffold stays in
> tree for the day operator credentials arrive but is no longer the
> recommended-first integration. The `IDropshipDistributorAdapter`
> interface needs zero changes — both adapters implement it.
>
> **Vertical broadening:** the spec name stays
> "pc-parts-dropshipping-integration" for git-archaeology continuity,
> but the actual delivered storefront is **components + robotics +
> AI-edge hardware**. The CMS already supports this — same product
> module, same checkout, same category tree, just a broader SKU
> stream from TME.

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

### Distributor choice — ranked post-2026-05-16 research pivot

Operator picks one for the first integration. Adapter is interchangeable post-launch.

| Distributor | Coverage | API | Onboarding | Verticals covered | Notes |
|---|---|---|---|---|---|
| **TME** (Transfer Multisort Elektronik) — **recommended first** | PL HQ, pan-EU shipping, 30 language sites | Free public REST + GitHub SDKs | Self-service developer signup (days); B2B trade-account also days with VAT | PC parts + robotics + maker/Pi/Arduino + AI-edge dev hardware | https://developers.tme.eu/en — anonymous token + signed HMAC for B2B writes. ~1M+ SKUs. The pivot pick. |
| **Siewert & Kau** (DE) | DE HQ, EU-wide 24h ship | REST CSV feeds (price/stock) + openTRANS EDI (orders) | B2B trade account, days with VAT + Gewerbeschein | PC parts deep, ~30k brand-deep SKUs | Order leg is EDI not REST — adapter would need EDI transport. Strong second option for PC-parts depth. |
| **ITscope** (DE, aggregator) | Pan-EU via 400+ underlying suppliers | Full REST API 2.1 | €49/mo subscription + trade verification, days | Whatever the underlying suppliers carry — Also, Tech Data, Ingram, Wortmann, S&K, Api | Multiplier play: one API surfaces many suppliers. Still need supplier relationships on the back end, but lighter than direct onboarding each. |
| **ASBIS Baltics** (LV office) | Baltics + CEE primary | B2B portal + XML/CSV feeds (not REST-documented) | Standard B2B, faster for local LV operators | PC parts + some peripherals | Walk-in viable in Riga. Adapter would be CSV+portal not REST. |
| **TD SYNNEX** (StreamOne Ion) — scaffold dormant | All EU + UK | REST + OData | 2–4 week B2B onboarding, volume commitments | PC parts, broad brand catalogue | Indie-hostile per 2026-05-16 research. Scaffold (`TdSynnexStreamOne.ts`) stays in tree but is no longer recommended-first. |
| **Ingram Micro Xvantage** | All EU + UK | REST + GraphQL | Same gating as TD SYNNEX | PC parts | Not pursued. |

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
COMMERCE_DROPSHIP_ADAPTER=tme                     # tme | tdSynnex | ingramMicro | asbis

# TME (recommended first impl — self-service signup at developers.tme.eu)
TME_API_BASE=https://api.tme.eu
TME_TOKEN=                                        # anonymous integration token
TME_APP_SECRET=                                   # HMAC-SHA1 signing key (required for B2B writes)
TME_COUNTRY=LV                                    # ISO-3166-1 alpha-2
TME_LANGUAGE=EN

# TD SYNNEX StreamOne Ion (scaffold dormant — 2–4 week partner-account onboarding)
TD_SYNNEX_API_BASE=https://api.streamonecloud.com
TD_SYNNEX_CLIENT_ID=
TD_SYNNEX_CLIENT_SECRET=
TD_SYNNEX_RESELLER_ID=                            # operator's partner reseller code

# Ingram Micro Xvantage (not pursued post-research; kept for archaeology)
INGRAM_API_BASE=https://api.ingrammicro.com
INGRAM_CLIENT_ID=
INGRAM_CLIENT_SECRET=
INGRAM_CUSTOMER_NUMBER=

# Asbis B2B (alternative — walk-in viable in Riga)
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

**TME-first path (recommended post-2026-05-16 research pivot):**

1. **Sign up TME developer account** at https://developers.tme.eu/en/signup — self-service, anonymous-token issued immediately. Read-side calls (catalogue browse) work with this alone.
2. **Sign up TME B2B trade account** in parallel — requires registered business + VAT ID. Days, not weeks. Once active, you get `TME_APP_SECRET` (HMAC signing key) needed for order placement.
3. **Drop credentials in `.env`** — `TME_TOKEN`, `TME_APP_SECRET`, `TME_COUNTRY=LV`, `TME_LANGUAGE=EN`. Adapter's `isConfigured()` flips to true; admin pane stops surfacing the "not credentialed" banner.
4. **Smoke-test** — TME has no formal sandbox; run a small real order through manually first (€10–50 to your own address) to confirm shipping propagation + tracking webhook delivery. Then switch the adapter to live.
5. **Curate initial catalogue subset** (~100–200 SKUs) before opening firehose-mode sync. TME has 1M+ SKUs; you don't want them all in your storefront on day one.
6. **Cutover** — flip `COMMERCE_DROPSHIP_ENABLED=true`, set `COMMERCE_DROPSHIP_ADAPTER=tme`.

**TD SYNNEX path (only if operator already has the partnership):** same flow but with `TD_SYNNEX_*` env vars and `COMMERCE_DROPSHIP_ADAPTER=tdSynnex`. 1–2 weeks of upfront onboarding + reseller agreement before step 1 even starts.

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
