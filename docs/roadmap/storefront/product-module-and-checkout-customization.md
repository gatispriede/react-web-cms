---
name: product-module-and-checkout-customization
description: New first-class content module `Product` (with featured / grid / carousel / comparison / related variants) that operators can compose into any page like Hero / Manifesto / Gallery. Pairs with a `siteFlags.checkoutEnabled` master switch + per-variant checkout customization (single vs multi-step, required fields, payment-provider sub-toggles, shipping methods, order-summary template, post-purchase redirect, abandoned-cart recovery). When checkout is disabled, products render catalogue-only — no Buy CTAs, no cart drawer, no `/checkout` routes; the storefront becomes a portfolio of products without commerce. Mirrors the auth-split-client-admin pattern (master flag → conditional UI surface area).
---

# Product module + checkout customization + storefront-enable flag

## Goal

Two related deliverables shipped as one chunk:

### Part 1 — `Product` content module

Today products exist as a back-of-house entity (`IProduct` schema, `/products` listing page, product detail page, cart, checkout — all already shipped per Wave 7b verification). But there's no **module** an operator can drop into an editorial page to feature a product, list a curated grid, or run a carousel of bestsellers. Hero / Manifesto / Timeline / ProjectGrid / Gallery / List all exist as composable modules — Product doesn't.

Ship `ui/client/modules/Product/` with **5 variants** dispatched by a per-instance `mode` field:

- `featured` — one product, large hero treatment (image left + title/desc/price/Buy CTA right; mobile stacks)
- `grid` — N×M product cards with title + price + image + optional Buy CTA per card
- `carousel` — horizontally-scrolling product cards, mobile-friendly snap-scroll
- `comparison` — table-style side-by-side spec comparison (reuses W5.5a `ComparisonTable` shared component)
- `related` — auto-populated from the page's primary product's `IProduct.relatedTo` or category tag

Each variant has its own editor surface (predefined Select for layout options, product picker, mode-specific controls).

### Part 2 — Checkout customization + `siteFlags.checkoutEnabled` master switch

Mirrors the auth-split pattern: a system-settings master toggle that controls whether checkout is enabled storefront-wide. Plus per-variant configuration so operators can tailor checkout to their business model.

**Master switch `siteFlags.checkoutEnabled`:**

- **OFF (default)** → `/checkout/*` routes 404 via middleware; `<BuyCta>`, `<CartDrawerToggle>`, `<AddToCartButton>` all early-return `null`; `Product` modules render catalogue-only (no Buy CTAs, just spec + image + price); cart system silently no-ops on any leftover hook calls; sitemap omits `/checkout/*`; the site behaves like a portfolio of products without commerce.
- **ON** → all checkout routes serve; Buy CTAs render on `Product` modules per their per-instance `showBuyCta` flag; cart drawer mounts in site header; abandoned-cart recovery enabled (W8f notifications already shipped the email side).

**Checkout customization (when enabled):**

Per-site config in `siteFlags.checkout`:

- `flow: 'single-step' | 'multi-step'` — single-step keeps everything on one page (better mobile conversion per research); multi-step splits into address / shipping / payment / review (better for high-AOV / B2B)
- `requireAccount: boolean` — false by default (guest checkout is the W6c-binding research finding); when true, hides guest path entirely
- `fields: { phone, company, vatId, shippingNotes }` — each `'required' | 'optional' | 'hidden'`
- `paymentProviders: { stripe, paypal, klarna, bankTransfer, cashOnDelivery }` — per-provider sub-toggle (Stripe already env-gated via W8g)
- `shippingMethods: IShippingMethod[]` — operator-defined; each has display name + flat-rate / weight-based / free-threshold logic
- `orderSummaryTemplate: 'compact' | 'detailed'` — compact = price + total only; detailed = line items + tax breakdown + shipping breakdown
- `postPurchaseRedirect: 'order-confirmation' | 'custom-thank-you' | 'magic-link-signup'` — the third option upgrades the guest order to a magic-link account on post-purchase (binds the order to the customer for tracking)
- `abandonedCartEmail: { enabled, delayMinutes, discountCode? }` — fires through W8f notification system

## Why now

- **Product as a content surface, not just a back-office entity.** Operators today have no way to feature a product in editorial content — they can link to `/products/[slug]` from a `<RichText>` block but can't visually compose a "**Buy our flagship**" hero into a landing page. This is the gap blocking marketing-led product launches.
- **The auth-split-client-admin item just landed the same pattern.** A `siteFlags.<feature>Enabled` master switch + conditional UI mounting + per-feature sub-toggles + 404-when-off middleware. Reusing that pattern for checkout keeps the storefront feature-toggle UX consistent: operators learn once, apply twice.
- **Some customers want catalogue-only sites.** Photographers showing portfolio pieces, designers showing case studies, agencies showing past clients-as-products — they want the product schema for organization but no commerce surface. Today `/checkout/*` is publicly reachable even on sites the operator doesn't intend to sell from. The off-by-default flag fixes this.
- **Checkout config is currently hardcoded.** The `/checkout` flow has a single shape (multi-step address → payment → review). Some businesses need single-step (mobile-first conversion); some need B2B fields (VAT ID, company name, PO number); some need cash-on-delivery (Latvia / Eastern Europe norm). All require customization.
- **Product module unlocks the `Product` testbed for the W7a/W7b cars-vertical reuse.** The `CarListingCard` + `CarVehicleDetailPage` modules shipped in Wave 7b could be re-expressed as `Product mode=featured` + `Product mode=grid` once this module exists — eliminating a second parallel codebase.

## Design

### Part 1 — `Product` module

#### Data model

```ts
// shared/types/modules/IProductModule.ts
interface IProductModule {
    mode: 'featured' | 'grid' | 'carousel' | 'comparison' | 'related';

    // Common across modes
    products?: {
        source: 'manual' | 'category' | 'tag' | 'auto';
        ids?: string[];              // when source='manual', list of product IDs
        category?: string;           // when source='category', slug
        tag?: string;                // when source='tag', tag
        autoRule?: 'bestsellers' | 'recent' | 'on-sale' | 'related'; // when source='auto'
        limit?: number;              // default per-mode
    };

    // Per-mode options
    showBuyCta?: boolean;            // default true (only renders if checkoutEnabled also true)
    showPrice?: boolean;             // default true
    showRating?: boolean;            // default false (only renders if reviews exist)
    showStockBadge?: boolean;        // default false

    // featured mode
    featured?: {
        imagePosition: 'left' | 'right' | 'top' | 'background';
        ctaText?: string;            // override default "Buy now"
        ctaStyle: 'primary' | 'secondary' | 'ghost';
    };

    // grid mode
    grid?: {
        columns: 2 | 3 | 4 | 5 | 6;     // mobile auto-falls to 2
        rows?: number;                  // optional cap
        density: 'compact' | 'standard' | 'spacious';
    };

    // carousel mode
    carousel?: {
        slidesPerView: 2 | 3 | 4;       // mobile auto-falls to 1
        autoplay?: boolean;
        showDots: boolean;
        showArrows: boolean;
    };

    // comparison mode
    comparison?: {
        rows: 'all-attributes' | string[]; // explicit list of attribute keys
        highlightDifferences: boolean;
    };

    // related mode — minimal config; auto-populates from primary product
    related?: {
        rule: 'same-category' | 'same-tags' | 'frequently-bought-together';
    };
}
```

Predefined enums everywhere. No free-text for `mode` / `source` / `density` / `ctaStyle`. Operator's product-IDs entered via a picker (search by slug + name), not a typed list of UUIDs.

#### Files

- `ui/client/modules/Product/` (new folder):
    - `Product.tsx` — mode dispatcher
    - `ProductFeatured.tsx` — one-product hero layout
    - `ProductGrid.tsx` — N×M grid
    - `ProductCarousel.tsx` — snap-scroll carousel
    - `ProductComparison.tsx` — spec-comparison table (composes W5.5a `ComparisonTable`)
    - `ProductRelated.tsx` — auto-populated related
    - `ProductCard.tsx` — shared card primitive used by grid/carousel/related
    - `Product.scss` — base styles (token-driven; each theme overrides via `module-styles.scss`)
    - `Product.types.ts` — `IProductModule` re-export + helpers
- `ui/admin/modules/Product/` (new folder):
    - `ProductEditor.tsx` — mode picker + per-mode editor surfaces
    - `ProductPickerControl.tsx` — predefined Select with product search (reuses existing product API; not free text)
    - `ProductSourceControl.tsx` — radio for `manual` / `category` / `tag` / `auto`
- `services/features/Modules/registry.ts` — register `Product` as a new `EItemType` value with all 5 mode variants exposed in the module-add picker

`Product` module is dispatched the same way as existing modules (`SectionContent.tsx` → `EItemType.Product`).

#### `Buy` CTA / cart integration

`<BuyCta product={p}>` is its own component, mounted by ProductFeatured + ProductCard. It:

- Reads `siteFlags.checkoutEnabled` from SSR-injected `InitialPageData`. If false, early-return `null`.
- Reads the per-instance `showBuyCta` flag. If false, early-return `null`.
- When clicked: calls the existing `cart.addItem` API + opens the cart drawer.
- Disabled when `product.stockStatus === 'out-of-stock'` (existing field).
- Shows multi-currency `<PriceDisplay>` (W8g shipped this).

#### MCP coverage

Existing `module.add` / `module.update` MCP tools already accept arbitrary module content blobs; the schema additions are advisory. Add:

- `product.module.preview { moduleConfig }` — server-renders the module against current product data + returns the HTML snippet (used by admin's inline-edit preview + the W6a email preview pattern). Mirrors `email.preview`.

### Part 2 — Checkout customization

#### Schema additions

```ts
// shared/types/ISiteFlags.ts (extension)
interface ISiteFlags {
    // ...
    checkoutEnabled?: boolean;          // default false
    checkout?: ICheckoutConfig;         // ignored when checkoutEnabled !== true
}

interface ICheckoutConfig {
    flow: 'single-step' | 'multi-step';
    requireAccount: boolean;
    fields: {
        phone: 'required' | 'optional' | 'hidden';
        company: 'required' | 'optional' | 'hidden';
        vatId: 'required' | 'optional' | 'hidden';
        shippingNotes: 'required' | 'optional' | 'hidden';
    };
    paymentProviders: {
        stripe?: boolean;
        paypal?: boolean;
        klarna?: boolean;
        bankTransfer?: boolean;
        cashOnDelivery?: boolean;
    };
    shippingMethods: IShippingMethod[];
    orderSummaryTemplate: 'compact' | 'detailed';
    postPurchaseRedirect: 'order-confirmation' | 'custom-thank-you' | 'magic-link-signup';
    abandonedCartEmail?: {
        enabled: boolean;
        delayMinutes: number;            // default 60
        discountCode?: string;
    };
}

interface IShippingMethod {
    id: string;
    name: string;                        // i18n-aware via translation keys
    type: 'flat-rate' | 'weight-based' | 'free-threshold' | 'pickup';
    flatRate?: { amount: number; currency: string };
    weightBased?: { ratePerKg: number; currency: string };
    freeThreshold?: { minOrderTotal: number; currency: string };
    pickup?: { location: string };
    availableCountries?: string[];       // ISO codes; empty = all
}
```

All enums predefined. `IShippingMethod.type` etc. all constrained Selects in the admin pane.

#### Checkout flow renderer

Today's `/checkout/*` pages (`/cart`, `/checkout/address`, `/checkout/shipping`, `/checkout/payment`, `/checkout/confirmation`) are hardcoded multi-step. Refactor to:

- `<CheckoutShell mode={flow}>` — wraps the flow, mode-dispatches single-step vs multi-step
- `<SingleStepCheckout>` — everything on one page (sticky cart summary; address + shipping + payment form stacked)
- `<MultiStepCheckout>` — current behavior, kept (default for back-compat)
- Each step reads `checkout.fields.*` from `siteFlags` to decide whether to render phone/company/vatId/shippingNotes inputs

Step config drives `<FormField required={fields[name] === 'required'} hidden={fields[name] === 'hidden'}>`.

#### Payment provider sub-toggles

- Stripe — env-gated via existing W8g `STRIPE_SECRET_KEY` + `STRIPE_PUBLIC_KEY`
- PayPal — new env vars `PAYPAL_CLIENT_ID` + `PAYPAL_SECRET`
- Klarna — new env vars `KLARNA_API_KEY` + `KLARNA_MERCHANT_ID`
- BankTransfer — pure offline; operator-provided IBAN displayed at order confirmation; order stays `pending-payment` until operator manually marks paid
- CashOnDelivery — pure offline; order proceeds to `pending-delivery` immediately; payment recorded on operator's manual mark-paid action

Each provider has a small `<PaymentProvider name="...">` adapter that the checkout payment step composes when its flag is on. Adding a new provider is additive: drop a new adapter file + register in `paymentRegistry.ts`.

#### Shipping methods admin pane

New surface `ui/admin/features/Checkout/ShippingMethods.tsx` — CRUD over `IShippingMethod[]`. Drag-reorder (visual priority for customer); per-method type picker; country availability multiselect (from existing W8g country list).

#### Abandoned-cart recovery

When `abandonedCartEmail.enabled === true`:

1. Cart adds emit a `Cart` Mongo doc with `userId | guestEmail | items | updatedAt`
2. A new `services/features/Checkout/AbandonedCartWorker.ts` cron-fires every 5 min (existing scheduler pattern from W8c/W8f workers)
3. Carts where `updatedAt > delayMinutes ago` AND not converted to order send a recovery email via W6a templates (new template: `services/features/Email/templates/abandoned-cart.tsx`)
4. Recovery email includes the cart preview + optional discount code + magic-link-like resume URL (`/cart?resume=<token>`)
5. Conversion tracking: when the recipient places the order, mark the recovery as converted

#### MCP coverage

- `checkout.config.get` / `checkout.config.set` — get/set the full `ICheckoutConfig`. Audit-logged.
- `checkout.shipping.list / create / update / delete` — CRUD over shipping methods. Match F8-bulk shape.
- `checkout.providers.list` — enumerate enabled payment providers + env-config readiness state (✅/❌)
- `checkout.cart.abandoned` — list abandoned carts (admin observability)

#### Admin pane

New `ui/admin/features/Checkout/CheckoutSettings.tsx` — full configurator:

- Master "**Enable checkout on this site**" Switch (mirrors auth-split UX)
- Flow Select (single-step / multi-step)
- requireAccount Switch
- Per-field Selects (required / optional / hidden) for phone / company / vatId / shippingNotes
- Per-provider Switches with env-config status badge
- Shipping methods sub-pane (links to ShippingMethods.tsx)
- Order summary template Select (compact / detailed)
- Post-purchase redirect Select
- Abandoned-cart sub-form (enabled / delay / discount code)

VM4-compliant (no `useState` in admin features). Sonner `notifyPromise` on save. testids everywhere.

### Storefront UI mounting (conditional on `checkoutEnabled`)

When flag is on:

- `<CartDrawerToggle>` mounts in `<SiteHeader>` (cart icon + item count badge)
- `<CartDrawer>` mounts at top of `<_app.tsx>` (slide-out panel)
- `<BuyCta>` renders inside `Product` modules per per-instance `showBuyCta`
- `<AddToCartButton>` renders on the existing `/products/[slug]` detail page
- Checkout routes serve
- Cart-related sitemap entries included

When flag is off:

- All four components return `null` (zero DOM, zero JS-side effect)
- `/checkout/*` routes return 404 via middleware
- Existing `/products/[slug]` detail page renders as a catalogue-only page (specs + image + price; no Buy button)
- Sitemap excludes checkout
- `Product` module's `showBuyCta` becomes inert (the `<BuyCta>` it tries to render is the null-returning component)

This mirrors the auth-split pattern exactly: master switch in `siteFlags`, conditional component mounting throughout, middleware-gated routes, sitemap-aware contributors.

## Files to touch

### New files

- `shared/types/modules/IProductModule.ts`
- `shared/types/checkout/ICheckoutConfig.ts`
- `shared/types/checkout/IShippingMethod.ts`
- `ui/client/modules/Product/` (7 files: dispatcher + 5 variants + shared card + scss + types)
- `ui/admin/modules/Product/` (3 files: editor + picker control + source control)
- `services/features/Checkout/CheckoutConfigService.ts`
- `services/features/Checkout/AbandonedCartWorker.ts`
- `services/features/Checkout/paymentRegistry.ts`
- `services/features/Checkout/providers/{stripe,paypal,klarna,bankTransfer,cashOnDelivery}.ts` (5 adapters)
- `services/features/Email/templates/abandoned-cart.tsx`
- `services/features/Mcp/tools/checkout.ts`
- `ui/admin/features/Checkout/CheckoutSettings.tsx` + ViewModel + AdminUILoader
- `ui/admin/features/Checkout/ShippingMethods.tsx` + ViewModel + AdminUILoader
- `ui/client/components/Commerce/BuyCta.tsx`
- `ui/client/components/Commerce/CartDrawerToggle.tsx`
- `ui/client/components/Commerce/CartDrawer.tsx`
- `ui/client/components/Commerce/AddToCartButton.tsx`
- `tests/e2e/storefront/product-module.spec.ts`
- `tests/e2e/storefront/checkout-disabled.spec.ts`
- `tests/e2e/storefront/checkout-single-step.spec.ts`
- `tests/e2e/storefront/abandoned-cart.spec.ts`
- `docs/runbooks/checkout-customization.md`

### Modified files

- `services/features/Modules/registry.ts` — register `EItemType.Product`
- `ui/client/lib/SectionContent.tsx` — dispatch `EItemType.Product` to the new module
- `ui/client/pages/checkout/index.tsx` + step pages — refactor onto `<CheckoutShell>` + mode dispatch
- `ui/client/pages/_app.tsx` — mount `<CartDrawer>` conditionally
- `ui/client/features/Header/SiteHeader.tsx` — mount `<CartDrawerToggle>` conditionally
- `ui/client/middleware.ts` — gate `/checkout/*` on flag
- `services/features/Seo/SiteFlagsService.ts` — add `checkoutEnabled` + `checkout` to `ISiteFlags`
- `ui/client/pages/api/sitemap/products.xml.ts` — exclude checkout pages when flag off
- `services/features/Mcp/tools/index.ts` — register `CHECKOUT_TOOLS`
- `ui/admin/lib/loaders/adminUILoaderRegistry.ts` — register CheckoutSettings + ShippingMethods loaders
- `ui/admin/i18n/{en,lv}.json` — copy for admin panes + storefront components
- `services/themes/{editorial,agency,commerce}/module-styles.scss` — per-theme `Product` module styles

## Acceptance

1. `EItemType.Product` registered + composable in any page via the module-add picker
2. All 5 `Product` variants render correctly with predefined Select controls (no free-text mode entry)
3. Product picker UI uses predefined `<Select options>` populated from existing product list (not free-text IDs)
4. `siteFlags.checkoutEnabled === false` (default) → `/checkout/*` returns 404; `<BuyCta>`, `<CartDrawerToggle>`, `<CartDrawer>`, `<AddToCartButton>` all render nothing; `Product` modules show catalogue-only treatment; sitemap omits checkout pages
5. `siteFlags.checkoutEnabled === true` → all checkout routes serve; cart drawer mounts; Buy CTAs render per per-instance `showBuyCta`
6. `flow: 'single-step'` puts everything on one page; `flow: 'multi-step'` keeps existing behavior
7. Per-field config (`phone`/`company`/`vatId`/`shippingNotes`: required/optional/hidden) honoured in all flows
8. Each payment provider's sub-toggle hides/shows the option at checkout
9. Shipping-methods admin pane CRUDs `IShippingMethod[]` end-to-end (create, drag-reorder, delete with Sonner Undo)
10. Abandoned-cart worker fires emails per `delayMinutes` config; conversion tracked
11. MCP tools (`checkout.config.*`, `checkout.shipping.*`, `checkout.providers.list`, `checkout.cart.abandoned`, `product.module.preview`) all callable
12. 4 e2e specs green
13. Runbook published covering: how to enable checkout + each payment provider's env-var setup + abandoned-cart configuration + shipping-method setup
14. Per-theme `Product` module styling renders correctly under each of the 3 placeholder themes

## Effort

**XL · ~3-5 days AI** (broken down):

- `Product` module + 5 variants + dispatcher + admin editors: ~6-8h
- `siteFlags.checkoutEnabled` + middleware + conditional component mounting: ~2h
- Checkout shell refactor (single-step + multi-step modes): ~6h
- Payment provider adapters (5 providers; Stripe + offline already trivial via W8g; PayPal + Klarna are net-new wrapper code): ~4-6h
- Shipping methods admin pane + CRUD + drag-reorder: ~3h
- Abandoned-cart worker + email template + tracking: ~3h
- Admin Checkout Settings + Shipping Methods panes: ~3-4h
- MCP tools (~9 new): ~2-3h
- 4 e2e specs: ~2h
- Per-theme module styling slot (3 themes, minimal default — real polish is per-theme jump): ~1h
- Runbook + i18n: ~1-2h

If genuinely too large for one chunk per project standard §13 (jumps not iterations), split into:

- **Sub-jump A** — `Product` module + 5 variants + admin editors + MCP `product.module.preview` (~1.5d AI)
- **Sub-jump B** — `siteFlags.checkoutEnabled` + middleware + conditional UI mounting + catalogue-only mode (~1d AI)
- **Sub-jump C** — Checkout shell refactor + per-field config + payment providers + admin pane + 4 e2e specs (~2d AI)
- **Sub-jump D** — Abandoned-cart worker + email template + tracking (~0.5d AI)

Each sub-jump lands as its own PR per §13. Sub-jump A is independent. B depends on A. C depends on B. D depends on C.

## Dependencies

- W5 themes infrastructure (shipped) — per-theme `module-styles.scss` slot exists; this item fills it for `Product`
- W7b cars-vertical (shipped) — the `CarListingCard` / `CarVehicleDetailPage` modules become candidates to re-express as `Product mode=featured` + `Product mode=grid` in a follow-up consolidation jump (not part of this item)
- W8g multi-currency + tax (shipped) — `<PriceDisplay>` is the price renderer; VAT regime label flows into checkout
- W6a receipt + transactional emails (shipped) — abandoned-cart email is a new template alongside `receipt`, `order-confirmation`, etc.
- W6c signup + magic-link (shipped) — `postPurchaseRedirect: 'magic-link-signup'` consumes the magic-link-issue path
- W8f notification preferences (shipped) — abandoned-cart email honours `notificationPreferences.marketing` routing
- auth-split-client-admin (active queue) — `requireAccount: true` route gate consumes the customer-auth session; clean coexistence with the master `clientLoginEnabled` flag
- W8h SEO program (shipped) — sitemap contributors gate on `checkoutEnabled`

## Open questions

1. **Default product card layout per theme.** Each first-class theme has its own visual language; should the `ProductCard` primitive ship one default that themes override, or should each theme ship its own ProductCard variant? Recommended: one default + theme override slot, like other shared primitives. Operator decision: confirm at design-pass time.
2. **Multi-vendor / marketplace shape.** Out of scope for this item. If a customer later needs marketplace (multiple sellers on one storefront), it's its own roadmap item — but this design doesn't preclude it (`IProduct.vendorId` already exists per Wave 7b verification).
3. **Subscriptions / recurring products.** Out of scope for this item. Stripe Subscriptions integration would be its own follow-up; the W8g `StripeTaxService` adapter shape works for the API surface, but checkout flow needs subscription-specific UX.
4. **Inventory threshold display.** Per-product "Only 3 left!" urgency badge is a marketing-psychology nudge. Useful but separable — `showStockBadge` flag is shipped here; the threshold logic + copy can polish later.

## Out of scope

- Multi-vendor marketplace
- Subscriptions / recurring billing
- Dynamic pricing (time-of-day, demand-based) — fixed-price + manual sale price only
- B2B quote-request flow (separate roadmap item if a customer asks)
- Loyalty / rewards points system
- Real-time inventory sync with external warehouses beyond what Wave 7b adapter system provides
- Native mobile-app commerce (separate jump)

## Storefront UX details

### `Product mode=featured` example layout

```
┌─────────────────────────────────────────────────────┐
│   ┌──────────────┐                                  │
│   │              │   PRODUCT NAME                   │
│   │   IMAGE      │   Tagline / short description    │
│   │              │   ★★★★☆ (124 reviews)            │
│   │              │                                  │
│   │              │   €299  €349 (Save 14%)          │
│   │              │   [VAT-inclusive · Reverse-      │
│   │              │    charge B2B available]         │
│   └──────────────┘                                  │
│                       [  Buy now  ]                 │
│                       [Add to wishlist]             │
└─────────────────────────────────────────────────────┘
```

Mobile: image stacks above text, CTA full-width sticky at bottom.

### `Product mode=grid` example layout

3-column desktop, 2-column mobile. Each card:

```
┌────────────────┐
│                │
│     IMAGE      │
│                │
├────────────────┤
│ Product name   │
│ €99            │
│ [Add to cart]  │  ← only when checkoutEnabled
└────────────────┘
```

Hover: subtle elevation lift via W0b motion tokens (`--motion-duration-fast`).

### Catalogue-only treatment (when `checkoutEnabled === false`)

Same card layout minus `[Add to cart]`. Card becomes a link to `/products/[slug]` for product-detail browse. No commerce affordance anywhere.

### Single-step checkout layout

```
┌──────────────────────────────────────────────┐
│   ┌──────────────────────┐  ┌─────────────┐ │
│   │ Email + Address      │  │   Cart      │ │
│   │ Shipping             │  │   summary   │ │
│   │ Payment              │  │   (sticky)  │ │
│   │ [Place order]        │  │             │ │
│   └──────────────────────┘  └─────────────┘ │
└──────────────────────────────────────────────┘
```

Mobile: cart summary moves to top (accordion-collapsed), form below.

### Multi-step checkout layout

Current behavior, kept. Each step a separate page with progress indicator.
