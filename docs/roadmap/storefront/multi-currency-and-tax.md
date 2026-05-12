---
name: multi-currency-and-tax
description: Multi-currency pricing on IProduct + per-locale display + Stripe Tax + VAT regime resolution per buyer/seller jurisdiction. Closes the "no multi-currency in v1" note in IProduct.ts.
research: see _meta/research-findings-2026-05-12.md §3 (EU VAT specifics — margin scheme, cross-border).
---

# Multi-currency + tax calculation

## Goal

Today `IProduct` has a single `price: number` + `currency: string`. `shared/types/IProduct.ts` notes: *"No multi-currency in v1 — see docs/features/products.md §10.1."*

Scope:

1. **Multi-currency pricing** — `IProduct.prices: Record<ISO4217, MoneyAmount>` (one or more)
2. **Locale-driven display currency** — visitor at `lv` sees EUR, at `en-GB` sees GBP, configurable per-site
3. **FX fallback** — when a product has no price in the visitor's currency, convert from base via daily-snapshot FX rates (committed to Mongo, not live-API'd at every render)
4. **VAT regime resolution** — surfaces the right regime per buyer-seller jurisdiction pair (margin scheme / standard VAT / private seller / cross-border)
5. **Stripe Tax integration** — at checkout, Stripe Tax computes the actual VAT/sales tax + reverse-charge eligibility for B2B; product page shows estimated tax inclusive
6. **B2B VAT validation** — VIES lookup on EU VAT numbers; if valid, reverse-charge applies, tax stripped
7. **Tax-inclusive vs tax-exclusive display** — per-site flag (EU defaults to inclusive, US defaults to exclusive)

## Why now

- ss.com cars (Wave 7) needs VAT regime as a listing fact — already surfaced in [ss-com-cars-integration.md](ss-com-cars-integration.md) as `attributes.vat_regime`. The actual tax calculation closes the loop.
- Cross-border buyers (Estonian / Lithuanian / Polish) want LV listings priced in EUR (works) but also want to understand VAT reclaim eligibility.
- Multi-language EU sites lose conversion when prices stay in a non-local currency.
- Pre-public-deploy commerce hardening; deferring leaves operators manually computing VAT in support.

## Design

### Schema

```ts
// shared/types/IProduct.ts (revised)
interface MoneyAmount {
    amount: number;            // integer minor units (cents)
    currency: string;          // ISO 4217
}

interface IProduct {
    // …existing
    /** Replaces `price` + `currency` with a map. Backward-compat: if only one entry, behaves as today. */
    prices: MoneyAmount[];
    /** The base currency for FX fallback (typically EUR for LV sites). */
    baseCurrency: string;
    /** Tax handling. */
    tax?: {
        regime?: 'standard' | 'margin' | 'private-seller' | 'zero-rated' | 'exempt';
        category?: string;     // Stripe Tax category, e.g. 'txcd_99999999'
        included?: boolean;    // is the listed price tax-inclusive?
    };
    // legacy `price` + `currency` kept as fallback getters for one minor release
}
```

Migration: existing products auto-fill `prices = [{amount: price, currency}]` + `baseCurrency = currency` + `tax.included = true (EU default)`. Single-write migration; no downtime.

### FX snapshots

`FxRates` collection — daily snapshots from a fixed provider (recommended: ECB published rates, free + authoritative for EU):

```ts
interface IFxRate {
    date: string;              // ISO date
    base: string;              // 'EUR'
    rates: Record<string, number>;  // {'USD': 1.0832, 'GBP': 0.8567, ...}
    source: 'ecb' | 'manual';
    fetchedAt: string;
}
```

Background worker fetches once per day at 14:30 UTC (ECB publish time). Per-render conversion:

```ts
function convert(amount: number, from: string, to: string, asOf: Date): number {
    if (from === to) return amount;
    const snapshot = fxService.getNearest(asOf);
    const fromRate = snapshot.rates[from] ?? 1;
    const toRate = snapshot.rates[to] ?? 1;
    return Math.round((amount / fromRate) * toRate);
}
```

FX conversions are display-time only; the **actual transactional currency** is set by the operator at the source product. Never let a buyer "pay in their viewing currency" with FX exposure on the platform.

### Display-currency selection

Visitor's currency resolved by (in priority):
1. Cookie `cms.display.currency` (customer-set override)
2. `IUser.preferredCurrency` for authed customers
3. Site default (operator-set)
4. Locale → currency mapping (`lv` → EUR, `en-GB` → GBP, `en-US` → USD, …)
5. Hard fallback to `baseCurrency`

Currency switcher in header dropdown (similar to language switcher). If a product doesn't have a native price in the selected currency, display "≈ €1,990 (converted)" with a tooltip explaining FX + checkout is in {actualCurrency}.

### VAT regime resolver

```ts
// services/features/Tax/vatRegimeResolver.ts
function resolveRegime(product: IProduct, buyer: BuyerContext, seller: SellerContext): VatRegime {
    if (product.tax?.regime === 'margin' || product.attributes.vat_regime === 'margin') {
        return {kind: 'margin', vatVisible: false, reclaimable: false};
    }
    if (seller.kind === 'private') {
        return {kind: 'private-seller', vatVisible: false, reclaimable: false};
    }
    if (buyer.country !== seller.country && buyer.isBusiness && buyer.vatNumber && buyer.vatVerified) {
        return {kind: 'reverse-charge', vatVisible: false, reclaimable: true, note: 'B2B intra-EU reverse charge — buyer self-accounts for VAT'};
    }
    return {
        kind: 'standard',
        vatVisible: true,
        reclaimable: buyer.isBusiness,
        rate: standardRateFor(seller.country),
    };
}
```

Displayed inline on every listing detail page as a small badge + tooltip (already specced in [ss-com-cars-integration.md](ss-com-cars-integration.md) for cars; generalises to all products here).

### Stripe Tax integration

`/checkout`:

1. Customer fills shipping address → triggers Stripe Tax `calculation` API
2. Stripe returns line-item tax + total tax + jurisdiction breakdown
3. Display updates with tax line + grand total
4. Customer confirms → payment intent created with Stripe Tax automatic tax enabled
5. On success → `IOrder.tax: {jurisdiction, amount, lines[]}` written

Reverse-charge: if buyer is B2B + valid VAT number + intra-EU, Stripe Tax handles automatically (zero-rated tax line + note in invoice).

Existing payment flow extends; no fundamental rewrite.

### VIES B2B VAT validation

`POST /api/checkout/validate-vat` proxy to the EU VIES SOAP API. Caches valid results 7 days, invalid 1 hour.

```ts
// services/features/Tax/viesValidator.ts
async function validate(vatNumber: string): Promise<{valid: boolean; name?: string; address?: string}> {
    const cached = await cache.get(`vies:${vatNumber}`);
    if (cached) return cached;
    const result = await fetch('https://ec.europa.eu/taxation_customs/vies/services/checkVatService', {/*…SOAP…*/});
    const parsed = parseViesResponse(result);
    await cache.set(`vies:${vatNumber}`, parsed, parsed.valid ? 7 * 86400 : 3600);
    return parsed;
}
```

Customer at checkout checks "I'm buying for a business" → reveals VAT number input → live-validates → reverse-charge applies if valid + intra-EU.

### Per-site tax display flag

`siteFlags.taxDisplay`:

- `'inclusive'` — prices shown VAT-included (EU default)
- `'exclusive'` — prices shown excl VAT; "+ VAT" suffix (US / B2B catalogues)
- `'auto'` — inclusive for consumer visitors, exclusive once B2B mode is active

Per-locale override possible if a site spans EU + non-EU markets.

### Operator pane

`/admin/system/tax` (new):

- Stripe Tax account status + connection
- VIES integration status
- FX rate snapshot table (last 30 days)
- Per-product tax category mapping (Stripe Tax categories — choose from registry)
- Per-country tax rate overrides (manual fallback if Stripe Tax is down)
- Reverse-charge audit (every B2B intra-EU transaction logged)

### MCP tools

| Tool | Description |
|---|---|
| `tax_setRegime` | Set per-product or per-category tax regime |
| `tax_setStripeCategory` | Map product to Stripe Tax category |
| `tax_simulateCheckout` | Run a what-if calculation for a hypothetical buyer × product |
| `fx_refreshRates` | Manual trigger for FX snapshot refresh |
| `fx_setManualRate` | Operator override (e.g. for currencies ECB doesn't publish) |
| `vies_validate` | Validate an EU VAT number |
| `multiCurrency_setPrice` | Add / update a per-currency price on a product |

## Files to touch

- `shared/types/IProduct.ts` — multi-currency schema migration
- `shared/types/IOrder.ts` — extend with `tax: {jurisdiction, amount, lines[]}`
- `shared/types/IFxRate.ts` (new)
- `services/features/Tax/TaxService.ts` (new)
- `services/features/Tax/TaxServiceLoader.ts` (new)
- `services/features/Tax/vatRegimeResolver.ts` (new)
- `services/features/Tax/viesValidator.ts` (new)
- `services/features/Tax/stripeTaxAdapter.ts` (new — wraps Stripe Tax API)
- `services/features/Tax/fxService.ts` (new)
- `services/features/Tax/fxWorker.ts` (new — daily ECB fetch)
- `services/features/Products/ProductService.ts` — extend with multi-currency reads + migrations
- `services/features/Orders/OrderService.ts` — Stripe Tax integration at finalize
- `services/features/Checkout/CheckoutFlow.ts` — display-time tax recalc on address change
- `ui/client/features/CurrencySwitcher/` (new)
- `ui/client/features/Checkout/TaxLineBreakdown.tsx` (new)
- `ui/client/features/Checkout/VatNumberInput.tsx` (new — with VIES live validation)
- `ui/client/components/PriceDisplay.tsx` (new — handles "≈ converted" pattern + tax-inclusive/exclusive)
- `ui/admin/features/Tax/Tax.tsx` (new — operator pane)
- `ui/admin/features/Tax/TaxAdminUILoader.ts` (new)
- `services/features/Mcp/tools/tax.ts` (new — all tax / fx tools above)
- Tests: FX snapshot fallback, VAT regime resolver matrix, VIES cache TTL, Stripe Tax integration with mocked Stripe API, multi-currency display fallback

## Acceptance

1. Existing products migrate to multi-currency shape without data loss (single-currency products auto-fill `prices` array)
2. Currency switcher in header changes display currency; FX conversion shown with "≈" indicator when not native
3. Daily ECB snapshot fetch + operator manual override available
4. Product page shows VAT regime badge correctly per [research findings §3 cross-border matrix](../_meta/research-findings-2026-05-12.md)
5. Checkout calls Stripe Tax `calculation` API on address change; tax line + grand total update reactively
6. B2B mode at checkout: VAT number input + VIES live validation + reverse-charge zero-rates the order
7. Stripe Tax automatic tax enabled on payment intent; jurisdiction breakdown written to `IOrder.tax`
8. Operator pane shows Stripe Tax + VIES status; FX rate table; per-product tax category mapping
9. MCP coverage: `tax_*` + `fx_*` + `vies_*` + `multiCurrency_*` tools
10. Audit log captures every reverse-charge transaction
11. E2E: visitor switches currency → product shows converted price → adds to cart → fills LV billing → tax = 21% → switches to GB billing → tax recalculates → enables B2B → enters valid VIES → tax zeros

## Effort

**L · ~6-8h AI.**

- Schema migration + multi-currency reads: ~1h
- FX service + ECB fetcher + snapshot fallback: ~1h
- VAT regime resolver + per-jurisdiction matrix: ~1h
- Stripe Tax integration (calculation + payment intent): ~1.5h
- VIES validator + cache: ~45 min
- Currency switcher + PriceDisplay + TaxLineBreakdown UI: ~1.5h
- Admin pane: ~1h
- MCP tools + tests: ~1h

## Dependencies

- [ss-com-cars-integration.md](ss-com-cars-integration.md) — VAT regime fact already captured; this completes the calculation
- Existing `Orders` + `Checkout` features
- Stripe account with Tax enabled (operator wall-clock)

## Open questions

- **[OPERATOR DECISION]** FX provider — ECB free (recommended) or paid (OpenExchangeRates, Wise API)? Recommend: ECB; covers EU operations + free.
- **[OPERATOR DECISION]** Tax provider — Stripe Tax (recommended; tightly integrated with existing payment flow) vs Avalara (more granular but separate integration). Recommend: Stripe Tax.
- **[OPERATOR DECISION]** Customer-facing FX disclaimer — "≈ converted" inline (recommended) vs separate notice page. Recommend: inline tooltip.
- **[OPERATOR DECISION]** Crypto / non-fiat currencies — out of scope v1? Recommend: out of scope; revisit if real demand.

## Out of scope

- Crypto payments (BTC / USDC) — separate item
- Buy-now-pay-later integrations (Klarna / Affirm) — extends checkout, separate item
- Per-customer historical FX (lock-in rate at quote time) — separate item; only matters for non-instant checkout
- Indirect tax filing assistance (operator submits returns) — Stripe Tax handles this externally
- Per-country regulatory tax holidays — operator manages via Stripe dashboard
