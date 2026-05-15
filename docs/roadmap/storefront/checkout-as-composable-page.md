---
name: checkout-as-composable-page
description: Refactor `/cart`, `/checkout`, `/checkout/address`, `/checkout/shipping`, `/checkout/payment`, `/checkout/confirmation` into the standard CMS `IPage` framework. Each checkout step becomes a composable page operators can edit — add trust badges, FAQ, support links, shipping calculators, guarantee text — without touching the underlying transactional flow. Default templates ship sensibly so a zero-config site renders a working checkout. Pairs with product-module-and-checkout-customization (which adds the `siteFlags.checkoutEnabled` master switch + per-step flow/field/provider customization) and products-as-composable-page (which establishes the auto-template + operator-override pattern this item reuses).
---

# Checkout as a composable page

## Goal

Today `/cart`, `/checkout/address`, `/checkout/shipping`, `/checkout/payment`, `/checkout/confirmation` are hand-coded React routes. Each step renders a fixed layout — the operator can change the site theme but can't add a "100% money-back guarantee" badge above the payment form, can't insert an FAQ section between shipping and payment, can't show their trust seals or testimonials at any step.

Refactor each checkout step into the existing `IPage` framework with `source: 'system-page'` (new discriminator value, alongside `'manual'` and `'warehouse-derived'` from products-as-composable-page). Each step page:

- Has a default section layout that ships with the platform (operators get a working checkout out of the box)
- Has one **required transactional section** that operators cannot remove (the form for that step) — same lock pattern as W2.5 admin content releases used for required-field validation
- Lets operators add any number of composable sections around the required transactional section (TrustBadges, FAQ, Testimonials, GuaranteeText, ShippingCalculator, RichText, SupportLink, NewsletterCta)
- Reuses W2.5 inline editing (8/24 modules already instrumented) for the editable sections
- Respects the W7b cars VAT-regime flow, W8g multi-currency display, W6a receipt-email post-purchase trigger
- Honors W6c guest-vs-customer auth + the auth-split-client-admin `clientLoginEnabled` flag

The checkout *flow* — sequencing, validation, payment-provider dispatch, order creation — stays in `services/features/Checkout/CheckoutService.ts` and the transactional sections that wrap it. Operators are composing the *surface* around the flow, not the flow itself.

## Why now

- **The sibling roadmap items establish the pattern.** products-as-composable-page treats catalogue surfaces as composable pages. product-module-and-checkout-customization parameterizes the *flow* (single-step vs multi-step, per-field requirements, payment-provider toggles). This item composes the *surface* with the same framework. Three items, one consistent operator UX.
- **Trust-building is checkout-specific content.** Stripe + Shopify research: visible trust signals at the payment step lift conversion 8-15% (money-back guarantee, security badges, return policy, customer reviews, support phone number). Today operators have no surface to place these without forking the codebase. The composable-page model lets every operator's checkout become a unique trust-builder without engineering work.
- **Operators want post-purchase content composability.** The `/checkout/confirmation` page is the highest-engagement surface in commerce — buyer is happy, attention is high. Operators want to add: "Subscribe to our newsletter for 10% off next purchase", "Refer a friend, get €10 credit", FAQ about delivery, downloadable order PDF, social-share buttons, related products. Today they get a flat "Thank you for your order" page with no composability.
- **Mirrors the auth-split + checkout-customization + products-as-page pattern.** Every storefront surface that's not pure transactional gets composable. This is the last big surface to convert.
- **Sub-jump-able after products-as-composable-page lands.** The infrastructure (system-page discriminator, required-section lock, sitemap exclusion for `noindex` pages) is reused. This becomes mostly a templating + section-registration jump.

## Design

### `IPage.source = 'system-page'`

New discriminator value:

- `'manual'` — operator-authored
- `'warehouse-derived'` — auto-generated from warehouse data (products-as-composable-page)
- `'system-page'` — built-in framework pages (checkout, cart, account dashboard, magic-link verify, etc.)

System pages:

- Auto-created by a migration on first boot (or first time `checkoutEnabled` flips on)
- Have a `systemPageKey: 'cart' | 'checkout-address' | 'checkout-shipping' | 'checkout-payment' | 'checkout-confirmation' | ...` discriminator pointing at which built-in slot they fill
- Have **one required section** flagged `locked: true` that the operator cannot delete (the cart-line-items rendering, the address-form rendering, etc.)
- All other sections operator-composable
- Reset-to-default action in the admin pane (revert to the system template, discard operator edits)

### System page registry

`services/features/Pages/SystemPageRegistry.ts` (new):

```ts
interface ISystemPageDefinition {
    key: SystemPageKey;
    slug: string;                              // /cart, /checkout/address, etc.
    titleI18nKey: string;
    requiredSectionKey: string;                 // identifies the locked transactional section
    requiredSectionFactory: () => ISection;     // builds it on first boot
    defaultLayout: ISection[];                  // full default section list including the locked one
    seo: {
        indexable: false;                       // always noindex (checkout is private)
        canonical: 'self';
    };
    accessGate?: 'customer-session' | 'guest-token' | 'open';
}

const SYSTEM_PAGES: ISystemPageDefinition[] = [
    { key: 'cart', slug: '/cart', requiredSectionKey: 'cart-line-items', ... },
    { key: 'checkout-address', slug: '/checkout/address', requiredSectionKey: 'checkout-address-form', ... },
    { key: 'checkout-shipping', slug: '/checkout/shipping', requiredSectionKey: 'checkout-shipping-method', ... },
    { key: 'checkout-payment', slug: '/checkout/payment', requiredSectionKey: 'checkout-payment-form', ... },
    { key: 'checkout-confirmation', slug: '/checkout/confirmation', requiredSectionKey: 'checkout-confirmation-summary', ... },
    { key: 'order-by-token', slug: '/orders/[token]', ... },
    { key: 'account-dashboard', slug: '/account', ... },
    // etc.
];
```

Each system page's default layout ships with sensible defaults (described per page below).

### Default section layouts

#### `/cart` (`systemPageKey: 'cart'`)

1. **Hero** (compact, mode: `text`) — "Your cart"
2. **CartLineItems** *(locked, required)* — line items + quantity controls + remove buttons; uses W8g `<PriceDisplay>` per line
3. **CartSummary** *(locked, required)* — subtotal + tax line (W8g) + shipping placeholder + grand total
4. **CartActions** *(locked, required)* — Continue Shopping CTA + Proceed to Checkout CTA
5. RecommendedProducts (optional, opt-in) — `Product mode=carousel` bound to "frequently bought together" rule from product-module-and-checkout-customization

Operator can add above/between/below: TrustBadges, GuaranteeText, FreeShippingProgressBar, NewsletterCta, etc.

#### `/checkout/address` (`systemPageKey: 'checkout-address'`)

1. CheckoutProgressBar *(locked when `flow: 'multi-step'`; absent when `single-step`)*
2. **CheckoutAddressForm** *(locked, required)* — email + shipping address + billing-same-as-shipping toggle + optional fields per `checkout.fields` config (W6/W7 product-module item)
3. CheckoutCartSummary *(locked, sticky right rail on desktop)*

Operator can add: GuaranteeText, SupportLink, ContinueAsGuest helper text, FAQ.

#### `/checkout/shipping` (`systemPageKey: 'checkout-shipping'`)

1. CheckoutProgressBar *(locked when multi-step)*
2. **CheckoutShippingMethod** *(locked, required)* — list of operator-defined `IShippingMethod[]` from product-module-and-checkout-customization; per-method price + ETA
3. ShippingCalculator (optional) — operator-supplied widget for weight/dimension-based shipping
4. DeliveryEstimateInfo (optional RichText)

#### `/checkout/payment` (`systemPageKey: 'checkout-payment'`)

1. CheckoutProgressBar *(locked when multi-step)*
2. **CheckoutPaymentForm** *(locked, required)* — payment provider selector + per-provider form (Stripe / PayPal / Klarna / BankTransfer / CashOnDelivery per the product-module item's adapters)
3. CheckoutCartSummary *(locked)*
4. **PlaceOrderButton** *(locked, required)*

Operator can add: TrustBadges (PCI / SSL / accepted-cards), MoneyBackGuarantee, ReturnPolicyExcerpt, SecurityFAQ, CustomerSupportPhone, recent-order-count nudge ("324 people bought this today").

#### `/checkout/confirmation` (`systemPageKey: 'checkout-confirmation'`)

1. **OrderSummary** *(locked, required)* — order number + items + total + delivery address
2. NextSteps (optional RichText) — "What happens next" copy
3. UpsellRelatedProducts (optional, opt-in) — `Product mode=related` to drive next purchase
4. NewsletterCta (optional)
5. ReferAFriendCta (optional, hooks into existing marketing-attribution from W6c)
6. SocialShareButtons (optional)
7. DownloadInvoiceButton (optional, generates W8g VAT-compliant PDF)
8. **MagicLinkAccountUpgrade** *(when `postPurchaseRedirect: 'magic-link-signup'` from product-module item)* — "Save this order to your account" prompt

#### `/account` (`systemPageKey: 'account-dashboard'`) — when `clientLoginEnabled` from auth-split-client-admin

1. **AccountWelcome** *(locked, required)* — "Hi, {name}"
2. **AccountQuickActions** *(locked)* — My orders / Notifications / Privacy / Sign out
3. RecentOrders (optional) — last N orders preview
4. Recommendations (optional, `Product mode=related`)
5. AccountSupportContact (optional)

### Operator-override preservation

Same mechanism as products-as-composable-page's worker preservation:

- Operator edits → page is "operator-managed"
- System-page update on platform upgrade only touches the locked sections' content (not the operator's added sections)
- "Reset to default" admin action wipes operator edits + restores `defaultLayout` (Sonner confirms via `notifyDestructive` with Undo)

### Sitemap + SEO

- All system pages emit `<meta name="robots" content="noindex,nofollow">` via W8h `SeoHead.indexable={false}` (already wired)
- Sitemap contributor (W8h) excludes `source: 'system-page'` entries
- `redirect-lookup` middleware (W8h) ignores system page slugs (they're fixed)

### Middleware gating

`/checkout/*` already gated by `siteFlags.checkoutEnabled` (product-module-and-checkout-customization item). This item doesn't change the gate; it just changes what renders when the gate is open.

`/account/*` already gated by `siteFlags.clientLoginEnabled` (auth-split-client-admin item). Same — composable surface only mounts when the flag is on.

### Admin pane

New `ui/admin/features/Pages/SystemPagesPanel.tsx`:

- List of all system pages with current `slug`, `lastEdited`, status (default vs operator-managed)
- Click → standard page editor (existing pane) — but with locked-section badges visually distinguishing what can't be removed
- Reset-to-default action per page with Sonner `notifyDestructive` confirmation

### MCP coverage

- `systemPages.list` — enumerate system pages + status
- `systemPages.get { key }` — fetch one
- `systemPages.update { key, sections }` — edit the operator-composable sections (locked sections rejected with a clear error message)
- `systemPages.reset { key }` — restore defaults
- `systemPages.preview { key }` — server-render the page against fixture data

Pattern matches W6a `email.preview` and W8h `seo.preflight`.

### New "locked section" UI affordance

In the admin section editor (existing Navigation pane), locked sections render with:

- Lock icon next to the title
- Tooltip on hover: "Required for checkout to function — cannot be removed"
- Edit-content allowed (operators can change the heading text on `CheckoutAddressForm` or reword `OrderSummary` copy)
- Reorder allowed within the locked group (operator can put CartActions above CartLineItems if they want — unusual but allowed)
- Delete button is disabled with the same tooltip

testid: `section-row-locked-{sectionId}`.

### New shared sections (need to ship as part of this item)

Most are wrappers around existing checkout flow components, exposed as `EItemType` values:

- `EItemType.CartLineItems` (locked-only)
- `EItemType.CartSummary` (locked-only)
- `EItemType.CartActions` (locked-only)
- `EItemType.CheckoutProgressBar` (locked-only)
- `EItemType.CheckoutAddressForm` (locked-only)
- `EItemType.CheckoutShippingMethod` (locked-only)
- `EItemType.CheckoutPaymentForm` (locked-only)
- `EItemType.CheckoutCartSummary` (locked-only — distinct from CartSummary; sticky sidebar variant)
- `EItemType.PlaceOrderButton` (locked-only)
- `EItemType.OrderSummary` (locked-only)
- `EItemType.MagicLinkAccountUpgrade` (locked-only)
- `EItemType.TrustBadges` (composable, anywhere) — operator picks badges from a curated set (PCI / SSL / Stripe-verified / accepted-cards / money-back / return-policy)
- `EItemType.MoneyBackGuarantee` (composable, free-text RichText with default copy)
- `EItemType.ShippingCalculator` (composable, plug-in for weight-based estimates)
- `EItemType.DownloadInvoiceButton` (composable, on confirmation page)
- `EItemType.ReferAFriendCta` (composable, hooks W6c marketing-attribution)
- `EItemType.SocialShareButtons` (composable)
- `EItemType.UpsellRelatedProducts` — alias for `Product mode=related`; not a new module type, just a curated config preset for the existing Product module

### Theme styling

Per-theme `module-styles.scss` in `services/themes/<slug>/` ships sensible defaults for each new section. Locked sections are theme-aware via W0b motion tokens, W5 first-class theme palettes, W8g `<PriceDisplay>` font.

### `single-step` flow integration

The product-module-and-checkout-customization item lets operators set `flow: 'single-step'`. In that mode:

- `/checkout/address`, `/checkout/shipping`, `/checkout/payment` system pages are not rendered as separate routes
- A single `/checkout` system page is used, whose default layout includes ALL the locked sections (CheckoutAddressForm + CheckoutShippingMethod + CheckoutPaymentForm + PlaceOrderButton) stacked on one page with a sticky CheckoutCartSummary
- The composable sections operators add to the multi-step pages get merged into the single-step page (operator picks via radio: "Apply multi-step composable sections to single-step page? Y/N")

This complexity is opt-in. Multi-step is the default and the simpler model.

## Files to touch

### New files

- `shared/types/IPage.ts` — extend with `source: 'manual' | 'warehouse-derived' | 'system-page'` (assuming products-as-composable-page lands first; otherwise add the discriminator here)
- `shared/types/ISystemPage.ts` — `SystemPageKey` enum + `ISystemPageDefinition`
- `services/features/Pages/SystemPageRegistry.ts` — registry of system pages + first-boot migration
- `ui/client/modules/Checkout/CartLineItems.tsx`
- `ui/client/modules/Checkout/CartSummary.tsx`
- `ui/client/modules/Checkout/CartActions.tsx`
- `ui/client/modules/Checkout/CheckoutProgressBar.tsx`
- `ui/client/modules/Checkout/CheckoutAddressForm.tsx`
- `ui/client/modules/Checkout/CheckoutShippingMethod.tsx`
- `ui/client/modules/Checkout/CheckoutPaymentForm.tsx`
- `ui/client/modules/Checkout/CheckoutCartSummary.tsx` (sticky sidebar)
- `ui/client/modules/Checkout/PlaceOrderButton.tsx`
- `ui/client/modules/Checkout/OrderSummary.tsx`
- `ui/client/modules/Checkout/MagicLinkAccountUpgrade.tsx`
- `ui/client/modules/Trust/TrustBadges.tsx`
- `ui/client/modules/Trust/MoneyBackGuarantee.tsx`
- `ui/client/modules/Checkout/ShippingCalculator.tsx`
- `ui/client/modules/Checkout/DownloadInvoiceButton.tsx`
- `ui/client/modules/Marketing/ReferAFriendCta.tsx`
- `ui/client/modules/Marketing/SocialShareButtons.tsx`
- `ui/admin/modules/Checkout/*` (admin editor surfaces for each new module type)
- `ui/admin/features/Pages/SystemPagesPanel.tsx` + ViewModel + AdminUILoader
- `services/features/Mcp/tools/systemPages.ts` — 5 new MCP tools
- `tests/e2e/storefront/checkout-pages-composable.spec.ts` — operator edits checkout-payment page, adds TrustBadges section, verifies it renders + reset-to-default works
- `tests/e2e/storefront/checkout-locked-sections.spec.ts` — operator cannot delete CheckoutPaymentForm; reorder within locked group works
- `docs/runbooks/checkout-page-composition.md`

### Modified files

- `services/features/Modules/registry.ts` — register all new `EItemType` values
- `ui/client/lib/SectionContent.tsx` — dispatch new types to the new modules; emit `data-section-locked` attribute when section is locked
- `ui/admin/features/Navigation/Layout.tsx` (or section-list editor) — render lock icon + disable delete on `locked: true` sections
- `services/features/Navigation/NavigationService.ts` — reject delete-section mutation when target section has `locked: true`
- `ui/client/pages/cart/index.tsx` — refactor to load `cart` system page + render its sections
- `ui/client/pages/checkout/address.tsx`, `shipping.tsx`, `payment.tsx`, `confirmation.tsx` — refactor each to load the corresponding system page
- `ui/client/pages/account/index.tsx` — refactor to load `account-dashboard` system page (depends on auth-split-client-admin's `clientLoginEnabled` flag)
- `ui/client/pages/orders/[token].tsx` — refactor to load `order-by-token` system page
- `services/features/Seo/sitemapContributors.ts` (W8h) — exclude `source: 'system-page'` entries
- `services/features/Mcp/tools/index.ts` — register `SYSTEM_PAGES_TOOLS`
- `ui/admin/lib/loaders/adminUILoaderRegistry.ts` — register SystemPagesPanel
- `services/themes/{editorial,agency,commerce}/module-styles.scss` — per-theme styling for new modules
- `ui/admin/i18n/{en,lv}.json` — copy for SystemPagesPanel + new sections

## Acceptance

1. `IPage.source = 'system-page'` discriminator landed; 8+ system pages auto-created on first boot
2. Each system page has its `defaultLayout` rendering correctly out-of-the-box
3. Each system page's required section(s) are `locked: true`; delete-section mutation rejected; admin UI shows lock icon + disabled delete button
4. Operator can add composable sections (TrustBadges, MoneyBackGuarantee, FAQ, RichText) above/between/below locked sections; persists; renders correctly
5. Operator can reorder locked sections within their group (e.g., put CartActions above CartLineItems)
6. Reset-to-default action restores `defaultLayout`; operator's added sections wiped; Sonner `notifyDestructive` with Undo
7. Sitemap excludes system pages
8. SEO emits `noindex,nofollow` on system pages
9. MCP tools (`systemPages.list/get/update/reset/preview`) all callable; `update` rejects edits to locked sections with clear error message
10. `single-step` flow (from product-module-and-checkout-customization) composes the same way (one `/checkout` system page with all locked sections stacked)
11. Auth-gated system pages (`/account*`) only mount when `clientLoginEnabled` (auth-split-client-admin) is true
12. Checkout-gated system pages (`/checkout/*`, `/cart`) only mount when `checkoutEnabled` (product-module-and-checkout-customization) is true
13. 2 e2e specs green: checkout-pages-composable, checkout-locked-sections
14. Operator runbook published: how to compose checkout, how to add TrustBadges, how to reset, how to override copy on locked sections, what happens on platform upgrade

## Effort

**L · ~2-3 days AI** (smaller than products-as-composable-page because the page framework + locked-section infra is already shipping with that item; this item mostly adds new modules + system-page registry):

- System page registry + first-boot migration + IPage discriminator extension: ~3-4h
- 12 new locked modules (Cart*, Checkout*, OrderSummary, MagicLinkAccountUpgrade): ~6-8h
- 6 new composable modules (TrustBadges, MoneyBackGuarantee, ShippingCalculator, DownloadInvoiceButton, ReferAFriendCta, SocialShareButtons): ~4-6h
- Locked-section UI affordance in admin section editor: ~2h
- Refactor 6 hand-coded routes onto system pages: ~3-4h
- Admin SystemPagesPanel: ~2-3h
- MCP tools (5): ~1-2h
- 2 e2e specs: ~1h
- Per-theme module-styles fill (minimal default): ~1h
- Runbook + i18n: ~1-2h

## Dependencies

**Hard (in active queue, must land first):**

- products-as-composable-page sub-jump A (introduces `IPage.source` discriminator; this item adds `'system-page'` value)
- product-module-and-checkout-customization sub-jump A (the `Product` module is consumed by RecommendedProducts + UpsellRelatedProducts sections)
- product-module-and-checkout-customization sub-jump C (the `siteFlags.checkout.flow` config drives whether single-step or multi-step layout applies)
- auth-split-client-admin (the `clientLoginEnabled` flag gates `/account*` system pages)

**Soft (already shipped):**

- W5 themes infrastructure → per-theme `module-styles.scss` slot for new modules
- W6a receipt + transactional emails → `DownloadInvoiceButton` reuses the W6a PDF rendering primitives
- W6c signup + magic-link → `MagicLinkAccountUpgrade` consumes the magic-link issue path
- W8g multi-currency + tax → `<PriceDisplay>` in CartLineItems / OrderSummary; VAT line in CartSummary
- W8h SEO → `noindex` emission + sitemap exclusion for system pages
- W2.5 inline editing → composable sections instrumented from the start (raise testid-CI's `data-edit-target` coverage)

## Open questions

1. **Multi-language system pages.** Each system page has a default `titleI18nKey`. Translations live in the existing `ui/admin/i18n/*.json` (admin-facing labels) + `ui/client/i18n/*.json` (customer-facing copy). The `Hero` section's title accepts i18n keys. Operator-added RichText sections are language-keyed per-locale (existing translation flow). This is consistent — no new mechanism.
2. **What happens on platform upgrade adding new locked sections?** E.g., a future jump adds `CarbonOffsetCheckbox` as a new optional locked section on `checkout-payment`. The system page's `defaultLayout` is updated; operator-managed pages get a notification ("New section available: would you like to add it to your checkout page? Reset-to-default | Add only this section | Dismiss"). Existing operator edits preserved. Out of scope for this jump; ship a simple migration warning for now and design the diff-UI later.
3. **Confirmation page after BankTransfer / CashOnDelivery.** These payment methods don't complete on the confirmation page — they show "Your order is pending payment / awaiting delivery". The system page detects payment method and conditionally renders different copy on `OrderSummary`. Out of scope to make this fully composable; ship hardcoded conditional copy in `OrderSummary` for now.
4. **Anonymous-checkout `/orders/[token]` page.** Already a real page (W6c shipped it). Refactor onto a system page in this jump for consistency.
5. **Per-tenant template overrides at the platform level.** Some operators may want their own default checkout template to ship globally across all their sites (multi-site operators). Out of scope; current model is per-site.

## Out of scope

- The transactional flow itself (handled by product-module-and-checkout-customization)
- The cart drawer / cart icon in header (the system page is the `/cart` route; the drawer is a separate UI surface in product-module-and-checkout-customization)
- Email template composability (W6a templates are a separate composable surface — `email.preview` MCP shipped)
- Payment method addition (each new provider is its own jump with adapter + admin config + this composable-page item exposes it once added)
- A/B testing of checkout templates (separable; ship the composability first)
- Conditional sections based on cart contents (e.g., "Show FreeShippingNote only when cart subtotal > €50") — out of scope; operators get static sections this jump

## Visual reference

### `/checkout/payment` with operator-added trust sections

```
┌────────────────────────────────────────────────────┐
│  STEP 3 OF 3  Payment                              │  ← CheckoutProgressBar (locked)
├────────────────────────────────────────────────────┤
│  100% Money-back guarantee · 30-day returns        │  ← MoneyBackGuarantee (operator-added)
├────────────────────────────────────────────────────┤
│  Choose payment method:                            │
│  ○ Credit card (Stripe)                            │
│  ○ PayPal                                          │  ← CheckoutPaymentForm (LOCKED)
│  ○ Klarna - Pay in 3                               │
│  ○ Bank transfer                                   │
│  [Card form fields when Stripe selected]           │
│                                                    │
│  [ Place order — €299.00 ]                         │  ← PlaceOrderButton (LOCKED)
├────────────────────────────────────────────────────┤
│  🔒 Secure SSL · PCI compliant · Stripe verified   │  ← TrustBadges (operator-added)
│  💳 Visa · MC · Amex · PayPal · Klarna             │
├────────────────────────────────────────────────────┤
│  Need help?  📞 +371 2X XXX XXX  ✉ support@…      │  ← CustomerSupportContact (operator-added)
├────────────────────────────────────────────────────┤
│  324 people bought this product today              │  ← optional nudge (operator-added RichText)
└────────────────────────────────────────────────────┘
```

Right rail (sticky on desktop):

```
┌──────────────────┐
│  YOUR ORDER      │
│  ───────         │
│  Item × 1  €299  │  ← CheckoutCartSummary (LOCKED, sticky)
│  ───────         │
│  Subtotal  €299  │
│  VAT 21%   €61.79│
│  Shipping  €0    │
│  ───────         │
│  Total    €360.79│
└──────────────────┘
```

Admin section editor for this page shows:

```
┌─────────────────────────────────────────────────┐
│  /checkout/payment   (operator-managed)         │
│  [ Reset to default ]                            │
│                                                  │
│  🔒 CheckoutProgressBar                          │
│  ✏  MoneyBackGuarantee                           │
│  🔒 CheckoutPaymentForm                          │
│  🔒 PlaceOrderButton                             │
│  ✏  TrustBadges                                  │
│  ✏  CustomerSupportContact                       │
│  ✏  PromotionalNudge                             │
│  🔒 CheckoutCartSummary                          │
│                                                  │
│  [ + Add section ]                               │
└─────────────────────────────────────────────────┘
```

Lock icon = locked section (no delete, content edit allowed). Pencil icon = operator-composable (full edit, delete, reorder allowed).
