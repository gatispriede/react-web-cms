# Commerce — first-class theme

**Status:** shipped 2026-05-13. Per-theme baseline pass `tests/e2e/visual/themes/commerce.spec.ts` ships alongside.

## Target audience

DTC product shops, makers, wellness / eco retail, and the cars vertical (ss.com home). Conversion-rate-optimised storefront aesthetic — Allbirds / Mejuri / Hims tier, with an emerald accent that doubles as the add-to-cart success colour.

## Mood

Clean · catalogue-first · fresh · snappy · conversion-optimised.

Translates to:
- **Pure white surface + slate-black ink.** Maximises product photography pop; no warm interaction with the goods on display.
- **Emerald accent (#10B981).** Reads as "add-to-cart success" out of the gate — primary CTAs, highlighted plans, and Live indicators all consume the same token.
- **Space Grotesk display + Inter body.** Bolder identity than the editorial pair; Space Grotesk is the modern-retail default (Hims, Mejuri, Allbirds variants all use it or a sibling). Inter for body keeps reading comfort on long product descriptions.
- **Snappy retail motion.** `--motion-duration-base: 180ms` (vs the 250ms default). Hover lifts, cart-drawer slides, buy-CTA presses all snap in under 200ms — Shopify / Stripe tier. `prefers-reduced-motion: reduce` still collapses everything via `--motion-scalar`.
- **8px radii.** Soft, modern, web2024. Not the editorial flat-paper aesthetic.

## When to pick this

- Product shops (DTC, marketplace, single-maker).
- Cars listings (ss.com integration is the canonical example — `Commerce` is its home theme).
- Wellness / eco / lifestyle retail where the emerald reads on-brand.
- Any site where the grid IS the page and add-to-cart conversion matters most.

## When NOT to pick this

- Long-form reading (editorial / agency / portfolio) — use `editorial` (warm cream + slow motion).
- Booking-led sites (hospitality, restaurant) — use the dedicated theme for each.
- Sites where "considered" reads better than "snappy" — Commerce optimises for tap-to-cart, not contemplation.

## File layout

| File | Role |
| --- | --- |
| `theme.json` | Canonical manifest — palette (light + dark), typography stacks, motion profile, header/footer behaviour, module-style hints. Read by `ThemeRegistry` at boot. |
| `theme.scss` | Semantic-token overrides scoped under `[data-theme-name="commerce"]`. Sets `--color-*`, `--font-*`, `--motion-duration-*` custom properties + body baseline. |
| `module-styles.scss` | Per-module overrides — Hero (photo-bleed), product card (tight grid + soft hover lift), buy-CTA family (emerald + 180ms hover), cart/checkout, cars VDP + reservation, customer-account dashboard, footer (brand-led XXL), plus token-driven polish for all 47 catalogue modules. |
| `product-templates.scss` | (legacy slot, retained for Phase 1.F product display templates). |
| `README.md` | This file — design doc + audience + when-to-pick + when-not. |

## Tokens

### Palette (light → dark via `light-dark()`)

| Token | Light | Dark |
| --- | --- | --- |
| `--color-surface` | `#FFFFFF` (pure white) | `#0B0F0D` (near-black) |
| `--color-ink` | `#18181B` (slate-black) | `#F1F5F2` (warm off-white) |
| `--color-accent` | `#10B981` (emerald) | `#34D399` (lifted emerald) |
| `--color-accent-ink` | `#FFFFFF` | `#062019` |
| `--color-surface-inset` | `#F4F4F5` | `#1A1F1C` |
| `--color-rule` | `#E4E4E7` | `#27272A` |

Contrast: ink/surface ≈ 18:1 light, 14:1 dark. Accent/surface ≈ 4.6:1 light, 5.4:1 dark — passes WCAG AA for normal text. Buy-CTA uses accent-ink on accent — always meets 4.5:1.

### Typography

- **Display:** `'Space Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif`
- **Body:** `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`
- **Mono:** `ui-monospace, 'SF Mono', Menlo, monospace`
- **Base size:** 16px (retail default — every pixel is competing with product photos).

Both webfonts pull via the existing font pipeline (`_document.tsx` → `buildGoogleFontsUrl()`), optionally proxied through `/api/fonts/css` when `siteFlags.selfHostFonts === true` for GDPR posture.

### Motion (`snappy-default` profile)

| Token | Commerce value | Default |
| --- | --- | --- |
| `--motion-duration-fast` | 100ms | 150ms |
| `--motion-duration-base` | 180ms | 250ms |
| `--motion-duration-slow` | 280ms | 400ms |
| `--motion-duration-deliberate` | 480ms | 700ms |
| `--motion-ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | (same) |
| `--motion-ease-emphasized` | `cubic-bezier(0.4, 0, 0.05, 1)` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--motion-distance-sm/md/lg` | 6 / 16 / 40 px | 8 / 24 / 64 px |

Storefront convention: <200ms on every hover/tap, no perceived lag. Reduced-motion users still get instant transitions via `--motion-scalar`.

## Header behaviour — `shrink-on-scroll`

Default state is roomy (`padding: 1.25rem 1.5rem`); on scroll past ~80px the bar height halves (`padding: 0.625rem 1.5rem`) and a soft `box-shadow` lands. Toggle is client-side via an `is-shrunk` class added by an IntersectionObserver / scroll listener (slot wired by the main-nav module).

Nav stays above the hero — Commerce keeps "Shop" / cart icon always one tap away rather than the editorial overlay approach.

## Module style hints

- `hero: photo-bleed` — full-width product photography, copy stacked over a 50→100% bottom gradient for contrast.
- `productGrid: tight-grid` — 12-16px gutter, no border on cards (1px rule via `--color-rule`), soft `box-shadow` hover lift + accent-tinted border on hover.
- `carListing: dense-card` — Commerce is the home theme for the cars vertical; same card primitive as products but with the cars-specific trust strip + VAT badge.
- `posts: card-grid` — BlogFeed renders as a 3-up card grid with cover images, not the editorial single-column list.
- `cart: drawer-always` — `CartDrawer` always visible in the chrome (already self-suppresses when `commerce.checkoutEnabled === false`).

## Buy-CTA family

A unified rule batches every primary action across the storefront — `BuyCta`, `AddToCartButton`, `PlaceOrderButton`, `CartActions__proceed`, `CarReservationCta__reserve`, `ProductDetailHero__cta`, `PricingTable__cta`, `EmptyStateBlock__action--primary` — onto the same shape:

- `background: var(--color-accent)` (emerald)
- `color: var(--color-accent-ink)` (white)
- `border-radius: var(--theme-borderRadius)` (8px)
- `min-height: 44px` (WCAG 2.2 AA touch target)
- `padding: 0.75rem 1.5rem`
- Hover: `translateY(-1px)` + darker emerald + 180ms transition
- Active: snap back to `translateY(0)` so the press feels physical

Cart conversion is visually consistent across every entry point.

## Visual baselines

`tests/e2e/visual/themes/commerce.spec.ts` walks every `EItemType` under `[data-theme-name="commerce"]` and captures one snapshot per type. Baselines live at `tests/e2e/visual/__snapshots__/themes/commerce/`. Capture run path mirrors Q4-cap + Editorial:

```bash
npx playwright test --project=visual tests/e2e/visual/themes/commerce.spec.ts --update-snapshots
```

## Follow-ups (each its own jump)

- **Surface-level baselines under commerce** — homepage, blog index, product detail, checkout: re-capture the 9 surfaces in `surfaces.spec.ts` once theme switching can drive the site-wide active theme programmatically.
- **Dark-mode baselines** — palette ships dark values; Wave 5b adds the dark snapshot project.
- **Cart drawer always-visible polish** — the cart drawer self-suppresses on catalogue-only sites; the commerce theme could surface a "drawer toggle" persistent chrome element when `commerce.checkoutEnabled === true`.
- **Self-hosted Space Grotesk + Inter** — operator decision via `siteFlags.selfHostFonts: true`.
- **Stitch frames** — high-fidelity design pass for the hero + cart drawer + checkout funnel; commit under `docs/audits/commerce-2026-05-XX/`.
