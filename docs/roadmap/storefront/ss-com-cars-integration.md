---
name: ss-com-cars-integration
description: ss.com cars as an Inventory adapter. Reservation-not-checkout flow (Cazoo failure mode avoided). Marketplace-style anonymous inquiry → account at deposit. VAT regime surfaced as a listing fact.
research: see research-findings-2026-05-12.md §3 Used-car marketplaces
---

# ss.com cars as Inventory adapter

## Goal

Ingest the **ss.com cars vertical** as a new adapter in the existing **Inventory feature**, write listings into the existing `IProduct` collection (`source: 'warehouse'` + `externalId`), and ship a buyer flow tuned to the used-car-marketplace UX patterns confirmed by the [research pass](../_meta/research-findings-2026-05-12.md):

- **Reservation, not full checkout** — €100-200 refundable deposit holds the car 48-72h; in-person handover settles payment. Avoids the Cazoo / Vroom D2C failure mode.
- **Marketplace-style anonymous inquiry** by default — buyer can contact the seller / view detail without an account. Account required only at deposit point.
- **15-20+ photos minimum** + spec sheet + history badge + VAT regime fact on every listing
- **Multi-select make/model** + range sliders for price/mileage/year + region multi-select (#1 ss.com user complaint solved by [storefront-faceted-filter-system](storefront-faceted-filter-system.md))
- **Sticky mobile CTA bar** (Call / Message / Reserve) — 70-75% of car shopping is mobile, 61% convert via phone
- **5-minute response-time SLA** target on inquiries (21× conversion vs >5 min per industry data)

## Why now

- The Inventory + adapter system **is already shipped** — 12+ existing adapters (`PostgresAdapter`, `RestApiAdapter`, `ShopifyAdapter`, `GenericFeedAdapter`, `Mock`, `WooCommerce`, `BigCommerce`, `Square`, `Airtable`, `GoogleSheets`, `NetSuite`, `SapBusinessOne`, `Odoo`). ss.com is **one more `IWarehouseAdapter` implementation**, not a new subsystem.
- `WarehouseProductInput` + `ProductService.upsertFromWarehouse` are wired — manual-overrides pinning, dead-letter queue, mutex'd run state, per-row idempotency, run state in `InventoryRuns` collection.
- This collapses what was an XL roadmap item into an **L** — a new adapter + a new public route + per-theme styling + a deposit-payment flow on top of the existing `Orders` feature.

## Architecture

### Adapter — slots into existing `IWarehouseAdapter`

Reference: `services/features/Inventory/adapters/IWarehouseAdapter.ts`, `GenericFeedAdapter.ts`. New file: `services/features/Inventory/adapters/SsComCarsAdapter.ts`.

The interface is the contract (already shipped):

```ts
interface IWarehouseAdapter {
    readonly id: string;
    fetchProducts(cursor?: string): Promise<FetchPage>;
    fetchProductsSince?(since: string, cursor?: string): Promise<FetchPage>;
    healthCheck(): Promise<HealthResult>;
}
```

`SsComCarsAdapter` implements this against the **path-segment-stable URL space** documented in the research:
- `https://www.ss.com/{lang}/transport/cars/{brand}/{model}/{deal-type}/`
- `https://www.ss.com/msg/{lang}/transport/cars/{brand}/{model}/{ad-id}.html`

### Acquisition path — what the research changed

**Research confirmed:** ss.com offers no public API, no documented RSS, no partner program. Apify scraper deprecated. **Path A (partner) is not realistic** — there's no documented partner program to negotiate with.

Revised acquisition plan:
- **Day 1 — fixtures + offline development.** Build the adapter against recorded HTML fixtures committed to `tests/fixtures/ss-com/`. No external traffic until the adapter is feature-complete.
- **Day N — operator-gated soft launch.** Operator turns on the adapter in admin. Rate-limited HTML crawl (≥3s between requests, configurable backoff), ETag / Last-Modified honoured, `User-Agent` identifies us, respects `robots.txt`. Per-ad-id dedupe (the `externalId` field, already in `IProduct`).
- **Path C (full scrape with hostile rotation) explicitly off the table.** Standing scope decision; would invite a block + legal exposure. Local POC scope per [project_local_poc_scope](../../C:/Users/User/.claude/projects/D--Work-redis-node-js-cloud/memory/project_local_poc_scope.md) — only fixture-driven development for now; revisit before any public-internet deploy.

### Storage — zero `IProduct` schema change

ss.com listings write into the existing `IProduct` collection:

| `IProduct` field | ss.com mapping |
|---|---|
| `source` | `'warehouse'` (existing enum value) |
| `externalId` | ss.com ad-id |
| `sku` | ss.com ad-id (no real SKU in classifieds context) |
| `title` | `${year} ${make} ${model} ${trim}` |
| `slug` | derived from title + ad-id |
| `description` | seller free-text |
| `price` | EUR amount (integer minor units) |
| `currency` | `'EUR'` |
| `stock` | `1` (each listing is unique) |
| `images` | scraped image URLs (downloaded + stored locally via existing Asset pipeline) |
| `categories` | `['cars']` plus body type (`['cars', 'sedan']`) |
| `attributes.make` | `'audi'` |
| `attributes.model` | `'a4'` |
| `attributes.year` | `'2018'` |
| `attributes.mileage_km` | `'124000'` |
| `attributes.fuel` | `'diesel'` |
| `attributes.transmission` | `'manual'` |
| `attributes.body` | `'sedan'` |
| `attributes.drive` | `'fwd'` |
| `attributes.color` | `'black'` |
| `attributes.region` | `'riga'` |
| `attributes.deal_type` | `'sell'` |
| `attributes.engine_cc` | `'1968'` |
| `attributes.inspection_date` | `'2026-09-30'` |
| `attributes.vat_regime` | `'margin'` \| `'standard-21'` |
| `attributes.country_of_origin` | `'DE'` |
| `attributes.seller_phone` | (raw — local POC scope only) |
| `attributes.seller_name` | (raw — local POC scope only) |
| `attributes.ss_com_url` | original listing URL |

Side table `ss_com_listings_raw` — original HTML payload keyed by ad-id. Lets us re-normalise without re-crawling if the field map changes.

### Lifecycle — reuses existing cascade engine

Listings disappear from ss.com when sold/expired:

- Ingest run flags every ad-id seen in this pass
- Ad-ids not seen → `product.draft = true` + `inventory.status = 'unavailable'` (soft)
- 7 days of consecutive unavailability → cascade to `Products.trash` (existing TTL'd collection)
- 24h grace before trash purges (existing 24h TTL on `*.trash`)

Per-mutation idempotency (the existing `idempotencyKey` arg pattern) on each upsert: key = `hash(externalId + contentHash)`.

### Buyer flow — reservation, not D2C checkout

**Research conclusion (binding):** end-to-end D2C used-car retail is not viable outside US scale + captive financing. Cazoo collapsed May 2024 with £260M debt; Vroom shut its e-commerce arm late 2023. AutoTrader's COO: "people research online, then want to see in person."

Three tiers of CTA on the listing detail page:

1. **Anonymous inquiry** (default) — contact form, opens to a `/inquiries` thread visible to operator + seller. No account required.
2. **Save / wishlist** — requires customer account. Adds to `/account/wishlist` (new — out of scope for this item; see Open questions).
3. **Reserve with deposit** — €100-200 refundable hold for 48-72 hours. Triggers account creation if not authed (per the delayed-account-creation pattern). Reservation expires automatically; deposit refunds.

The buyer never completes full payment online for the car. Reservation = hold the car off-market while the buyer arranges in-person inspection + cash/bank transfer for the full amount with the seller.

This means **`Order.total = deposit_amount`**, NOT vehicle price. We need a new field or convention on `IOrder` to distinguish "deposit reservation" from "full sale":

- Option A — `IOrder.kind: 'sale' | 'reservation-deposit'` (new optional field)
- Option B — convention: reservation orders carry `metadata.reservationOf: <productId>` and `metadata.fullPrice: <number>`

Recommend **A** (typed + explicit). Single-field schema change; existing orders unaffected (default 'sale').

### VAT regime — listing-level fact

Per the research, EU buyers across LV/EE/LT care about VAT regime (margin scheme = no reclaim; standard 21% = reclaimable for businesses). The listing card + detail page surface this as a labelled badge:

- `Margin scheme — VAT included, not reclaimable`
- `VAT 21% — reclaimable for businesses`
- `Private seller — no VAT`

Captured into `IProduct.attributes.vat_regime` during ingest (heuristic from listing copy + seller type; fallback to "unknown" with operator review queue).

### Admin

`/admin/content/inventory` (existing pane) — extend with adapter selector + ss.com config form:

- Path list (which `transport/cars/<brand>/<model>` paths to crawl)
- Language (lv / en / ru)
- Rate-limit (default 3000 ms, min 1500 ms)
- Dry-run button — fetches one page, shows parsed rows, doesn't write
- Field-map preview (which scraped columns hit which `IProduct.attributes` keys)
- Per-listing-action: pin to manual (warehouse stops overwriting), force-unavailable, trash-now

### MCP

Extend MCP coverage:

- `inventory_runIngest({adapterId: 'ss.com-cars'})` — already exists generically; verify the new adapter works through it
- `inventory_dryRun({adapterId, sampleSize})` — new
- `inventory_remapField({adapterId, src, dst})` — new
- `product_setVatRegime({productId, regime})` — operator-side review queue
- All MCP tools gated as advanced-only per existing `enforceModeForTool`

## Files to touch

- `services/features/Inventory/adapters/SsComCarsAdapter.ts` (new)
- `services/features/Inventory/adapters/index.ts` — register adapter
- `services/features/Inventory/adapters/parsers/ssCom.ts` (new) — HTML parsing (cheerio + targeted selectors)
- `services/features/Inventory/adapters/parsers/ssCom.fixtures.ts` (new) — committed HTML fixtures from real listing snapshots (no PII beyond what's already public)
- `shared/types/IOrder.ts` — add `kind?: 'sale' | 'reservation-deposit'` + `metadata.reservationOf?`, `metadata.fullPrice?`
- `services/features/Orders/OrderService.ts` — accept `kind` on create; finalize differently for reservation (no fulfilment scheduled, expiry timer instead)
- `services/features/Orders/reservationExpiry.ts` (new) — scheduled worker auto-refunds deposit + releases product after window
- `ui/client/pages/cars/index.tsx` (new) — product list using [storefront-faceted-filter-system](storefront-faceted-filter-system.md)
- `ui/client/pages/cars/[slug].tsx` (new) — detail page with photo gallery + spec table + VAT badge + reservation CTA + similar-listings strip
- `ui/client/features/CarReservation/` (new) — deposit flow (account check → magic-link signup if needed → Stripe deposit charge → confirmation)
- `ui/client/features/CarReservation/CarReservation.tsx` — UI
- `ui/client/features/CarReservation/CarReservationViewModel.ts`
- `services/features/Email/templates/carReservationConfirmation.ts` (new) — see [storefront-receipt-emails](storefront-receipt-emails.md)
- `ui/admin/features/Inventory/SsComCarsConfigForm.tsx` (new) — adapter-specific config UI
- `services/features/Mcp/tools/inventory.ts` — extend with adapter-specific tools
- Tests: adapter unit tests against fixtures; reservation expiry worker tests; e2e (browse cars → filter → detail → reserve as guest → email magic-link → upgrade to account → see in /account/orders)

## Starter code

See **Pattern E** in [agent-handoff-format.md](../_meta/agent-handoff-format.md) for the adapter skeleton.

Reservation creation:

```ts
// services/features/Orders/OrderService.ts (extension)
async createReservation(input: {
    productId: string;
    customerId?: string;
    guestEmail?: string;
    depositAmount: number;
    currency: string;
    idempotencyKey: string;
}): Promise<string> {
    const product = await this.products.get(input.productId);
    if (!product) throw new Error('product not found');
    if (product.draft || product.stock < 1) throw new Error('not available');
    if (product.categories.includes('cars') === false) throw new Error('reservation only available for cars');

    const orderId = guid();
    const order: IOrder = {
        id: orderId,
        orderNumber: nextOrderNumber(),
        customerId: input.customerId ?? null,
        guestEmail: input.guestEmail,
        orderToken: input.customerId ? undefined : guid(),
        kind: 'reservation-deposit',
        lineItems: [{
            productId: product.id,
            sku: product.sku,
            title: product.title,
            quantity: 1,
            unitPrice: input.depositAmount,
            total: input.depositAmount,
        }],
        subtotal: input.depositAmount,
        total: input.depositAmount,
        currency: input.currency,
        status: 'pending',
        idempotencyKeys: {authorize: input.idempotencyKey},
        metadata: {
            reservationOf: product.id,
            fullPrice: product.price,
            reservationExpiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        },
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };

    // Atomically reserve + write order — fail if product already reserved
    const reserved = await this.products.tryReserve(product.id, orderId);
    if (!reserved) throw new Error('already reserved by another buyer');

    await this.ordersDB.insertOne(order);
    await this.email.sendTemplated('carReservationConfirmation', input.guestEmail ?? (await this.customers.get(input.customerId!)).email, {order, product});
    return JSON.stringify({ok: true, orderId, orderToken: order.orderToken});
}
```

## Acceptance

1. `SsComCarsAdapter` registered in `adapters/index.ts`; passes `IWarehouseAdapter` contract tests
2. Adapter works against committed HTML fixtures; parses ≥95% of fixture rows without errors (dead-letter for the rest)
3. `ProductService.upsertFromWarehouse` writes ss.com listings with correct `source`, `externalId`, full `attributes` map including `vat_regime`
4. Manual override pinning preserved across re-syncs (verify in tests)
5. Lifecycle: unavailable after 1 missing run, trashed after 7 days, fully purged after 24h trash TTL
6. `/cars` lists products with `categories: ['cars']` + faceted filter system + saved searches (logged-in)
7. `/cars/[slug]` detail page: 15-20+ photo gallery, sticky CTA bar on mobile, spec table, VAT badge, 3-tier CTA hierarchy (Inquire / Save / Reserve)
8. Reservation flow: anonymous → magic-link signup → Stripe deposit charge → confirmation email with carReservationConfirmation template
9. Reservation expiry worker auto-refunds + releases product at the 48h mark
10. Operator can override `vat_regime` per-product from the admin (review queue)
11. MCP coverage parity for new mutations
12. E2E: full reservation flow against fixtures (no external traffic)

## Effort

**L · ~1-2 weeks AI** (was XL; collapsed by reusing existing Inventory adapter system).

- Adapter implementation + fixtures + parser: ~2 days
- `IOrder.kind` + reservation create + expiry worker: ~1 day
- Cars list page (consumes faceted filter system): ~half day
- Cars detail page + mobile sticky CTA: ~1 day
- Reservation flow + Stripe deposit + email template: ~1 day
- Admin adapter config + VAT review queue: ~half day
- MCP coverage: ~half day
- E2E + fixtures + dead-letter cases: ~1 day

## Dependencies

- **[storefront-faceted-filter-system](storefront-faceted-filter-system.md)** — cars list is the first real consumer. Either lands first or in parallel.
- **[client-signup-and-anonymous-checkout](client-signup-and-anonymous-checkout.md)** — magic-link auth + delayed-account-creation = the reservation auth path.
- **[storefront-receipt-emails](storefront-receipt-emails.md)** — `carReservationConfirmation` template shipped from there.
- **[first-class-themes](first-class-themes.md)** — Commerce or a new Restaurant-style "marketplace" theme for the cars surfaces.
- Existing Inventory + Orders + Products + Email features (all shipped).

## Open questions

- **[OPERATOR DECISION]** Deposit amount — flat €200 or % of car price (e.g. 1%, capped €100-500)? Recommend: flat €200 (clearer to buyer + simpler refund accounting).
- **[OPERATOR DECISION]** Reservation window — 48h or 72h? Recommend: 48h on weekdays / 72h if reservation falls over a weekend.
- **[OPERATOR DECISION]** Wishlist / saved-cars feature — separate roadmap item (recommend) or fold into this? Recommend: separate, file once we have signup live.
- Payment provider for deposit — Stripe Connect (likely) vs Adyen vs a Latvian-bank-friendly provider? Defer until we have a real seller-payment path designed.
- ss.com seller proxying — show seller phone directly (current research-confirmed behaviour) or proxy through us? POC: direct. Pre-public-deploy: revisit.

## Out of scope

- Real-time chat between buyer + seller (separate item; current path = email inquiry thread)
- Trade-in valuation (Carvana feature; not needed for marketplace model)
- Financing pre-qualification (Latvian banking integration; separate program)
- Title transfer / paperwork — handled in person between buyer + seller; we don't touch
- Other ss.com verticals (real estate, jobs, animals, …) — file as separate adapters when demand emerges; the adapter system supports them generically
