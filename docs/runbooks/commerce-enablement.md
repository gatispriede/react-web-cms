# Commerce enablement runbook

Phase 1.B sub-jumps A + B — operator-facing guide for enabling the
storefront commerce surface.

## States

- **OFF (default)** — `commerce.checkoutEnabled === false`. The
  storefront is catalogue-only:
  - `/checkout/*` routes 404 via `ui/client/middleware.ts`
  - `<CartDrawer>` / `<CartDrawerToggle>` / `<BuyCta>` /
    `<AddToCartButton>` all early-return `null`
  - `Product` modules render the card layout without Buy CTAs
- **ON** — `commerce.checkoutEnabled === true`. All commerce affordances
  mount; the existing `/checkout` flow lives unchanged.

## Flip the flag

Three equivalent paths:

1. **Admin pane** — `/admin/client-config/commerce` → toggle "Enable
   checkout on this site" → Save. Cache TTL is 30s; reload the
   storefront after that window for the new state to land.
2. **MCP** —
   ```
   commerce.config.set { path: "commerce.checkoutEnabled", value: true }
   site.publish
   ```
3. **DB direct** — set `SiteSettings.value.commerce.checkoutEnabled = true`
   on the `key: "siteFlags"` doc. Bump the `version`. Only for break-
   glass scenarios; the admin path is preferred.

After flipping, call `site.revalidate` (or wait for the next ISR window)
so static pages re-render with the updated affordances.

## Adding the Product module to a page

1. Open the page in `/admin/pages/<slug>`.
2. Add a section → add module → pick **Product** from the picker.
3. In the editor:
   - **Mode** — featured / grid / carousel / comparison / related
   - **Source** — manual / category / tag / auto. Manual uses the
     product picker; never type a UUID.
   - **Show Buy CTA** — leave on for commerce sites; toggle off for
     catalogue-only or "see-detail-page" cards. Inert when
     `commerce.checkoutEnabled` is off regardless.
4. Save → publish → revalidate.

## Failure modes + fail-closed semantics

- **Flag-status endpoint down** — middleware fails closed (treats flag
  as off → catalogue-only render). This is the deliberate default: a
  half-broken flag-status read should never leak the checkout surface.
- **Storefront flag fetch fails** — `useCommerceFlags()` returns
  `checkoutEnabled: false` on error, so cart drawer + Buy CTAs stay
  hidden.

## Sub-jump C — what's deferred

Per-flow customisation (single-step vs multi-step), payment-provider
sub-toggles (Stripe / PayPal / Klarna / bank transfer / cash on delivery),
operator-defined shipping methods, order-summary template, abandoned-
cart recovery. See
`docs/roadmap/storefront/product-module-and-checkout-customization.md`
§ sub-jump C for the planned scope.
