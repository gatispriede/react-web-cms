---
name: all-pages-module-composed
description: Every page on the site (public + admin-facing) is composed of operator-editable modules. Where no existing module provides the needed look or function, ship a new one. No bespoke hand-coded pages.
filed: 2026-05-13 by operator feedback during first-class-themes pass
---

# Module-compose every page

## Goal

Every page rendered to a visitor — checkout, /account/* surfaces, blog list + post, product detail, customer settings, magic-link landing, "your order" pages, even the homepage and per-category landing — is composed of operator-editable **modules** registered via the same system-page mechanism Phase 1.D introduced for checkout.

Hand-coded `pages/foo.tsx` with bespoke JSX is the exception, not the rule. When an operator picks a theme, the theme must be able to change every surface — and themes only change surfaces by changing **how modules render**, so every surface must be module-composed.

When an existing module doesn't have the look or function a page needs, **ship a new module** in the catalogue. Don't smuggle a fix into a page-level JSX file.

## Why now

The user filed this feedback after the first-class-themes pass landed (2026-05-13). The Editorial / Commerce / Agency / SaaS-landing / Restaurant themes each ship distinct module-level overrides — but those overrides only reach pages that are actually composed of modules. Hand-coded pages stay default-styled regardless of the active theme. That breaks the "pick a theme, your whole site looks different" promise.

## What's already module-composed

| Surface | Status | Phase |
| --- | --- | --- |
| Homepage / `/[lang]` | ✅ Section + module system | F1 + pre-F1 |
| Public page / `/[lang]/[slug]` | ✅ Same | F1 sub-pages |
| Cart `/cart` | ✅ system-page registration | Phase 1.D |
| Checkout address / shipping / payment / confirmation | ✅ 4 system-page registrations | Phase 1.D |
| Order-by-token `/orders/[token]` | ✅ system-page registration | Phase 1.D |
| Account dashboard `/account` | ✅ system-page registration (AccountDashboardGrid) | Phase 1.D |
| Magic-link verify `/account/verify` | ✅ system-page registration | Phase 1.D |
| Account settings `/account/settings` | ✅ system-page registration | Phase 1.E |
| Product detail `/products/[slug]` | ✅ ProductDetailTemplate auto-injection | Phase 1.C |
| Category landing `/[category-slug]` (warehouse-derived) | ✅ CategoryTemplate auto-injection | Phase 1.C |

## What's NOT module-composed yet (this jump)

| Surface | Today | Module-compose path |
| --- | --- | --- |
| `/account/orders` (list) | Hand-coded | Register `account-orders` system page; render an `OrdersList` module (NEW — needs to ship) |
| `/account/orders/[id]` (detail) | Hand-coded | Register `account-order-detail`; uses existing `OrderDetailModule` |
| `/account/addresses` | Hand-coded | Register `account-addresses`; render `AddressList` module (NEW) |
| `/account/payments` | Hand-coded | Register `account-payments`; render `PaymentMethodList` module (NEW) |
| `/account/searches` | Hand-coded | Register `account-searches`; uses existing `SavedSearchList` |
| `/account/wishlist` | Hand-coded | Register `account-wishlist`; uses existing `WishlistGrid` |
| `/account/inbox` | Hand-coded | Register `account-inbox`; render `NotificationInbox` module (NEW) |
| `/account/signup` | Hand-coded | Register `account-signup`; render `SignupForm` module (NEW) |
| `/account/signin` | Hand-coded | Register `account-signin`; render `SigninForm` module (NEW — operator chooses between password / magic-link / OAuth surfaces by selecting which existing modules to drop in) |
| `/account/login` (magic-link request) | Hand-coded | Register `account-magic-link-request`; uses existing `MagicLinkRequestForm` |
| `/account/magic-link` (landing) | Hand-coded | Register `account-magic-link-confirm`; uses existing `MagicLinkConfirmation` |
| `/blog` (list) | Hand-coded | Register `blog-index`; render `BlogFeed` module (exists; auto-inject + section dispatch path needs the registration) |
| `/blog/[slug]` (post) | Hand-coded | Register `blog-post`; render `BlogPost` module (NEW — title + cover + body sections) |
| `/welcome` (marketing landing) | Hand-coded | Register `marketing-landing`; uses existing `Hero` + `FeatureGrid` + `TestimonialWall` + `LogoCloud` + `PricingTable` |
| `/cars` (cars listing) | Hand-coded | Register `cars-index`; render `CarsList` module (NEW — drives the cars filter system) |
| `/cars/[slug]` (car detail) | Hand-coded | Register `cars-detail`; uses existing `CarVehicleDetailPage` composite |
| `/admin/preview/template/[id]` | Hand-coded preview route | Keep as-is — admin-only preview surface, not a customer page |

## Missing modules to ship (each its own jump)

- `OrdersList` — paginated customer-orders list with status filter
- `AddressList` — saved-addresses CRUD list
- `PaymentMethodList` — saved-payment-methods CRUD list
- `NotificationInbox` — in-app notification list with read/unread + mark-all-read
- `SignupForm` — full signup with magic-link / password / OAuth provider toggles
- `SigninForm` — equivalent signin surface
- `BlogPost` — blog post body wrapper (title + cover + content + author + date)
- `CarsList` — cars listing with faceted filter integration

## Theming requirement

For every module-composed page, each first-class theme MUST provide a distinct visual variant — not just colour. The user feedback explicitly called this out: "main part of themes is that they don't just change color and font it should be more radical per module to offer a completely different feeling from the other themes, that includes alignment, placement and arrangement as well as animations and maybe even functionality. good example is gallery module, where in default you have list of image and text, another theme has the same image txt but layered on each other, or listed specicly like a banner".

Filed as a follow-up jump: **radical-per-module-theme-variants** — Gallery list-vs-banner-vs-layered, Hero split-vs-overlay-vs-photo-bleed, Timeline horizontal-vs-vertical-vs-broken-grid, OrderProgressTimeline stepper-vs-rail-vs-bento, etc. per theme.

## Acceptance

1. Every customer-facing URL renders via a system-page registration + module dispatch (no bespoke JSX in `pages/account/*` or `pages/blog/*` or `pages/welcome.tsx` etc.).
2. Where no existing module covers the surface, a new module ships in `ui/client/modules/<Name>/` with full tests + theme-token support + at least one bespoke variant per first-class theme.
3. Switching the active theme changes every customer-facing page — verified via the per-theme visual baseline specs already in `tests/e2e/visual/themes/*.spec.ts`.

## Effort

**XL** (multi-week, parallelisable per page). Each page is its own small jump (S-M) once the system-page registration shape is followed; the count is what makes the overall scope XL.

## Dependencies

- Phase 1.D system-page infrastructure (`SystemPageRegistry`, `SystemPageDispatch`) — already shipped.
- First-class themes (5/5 shipped) so each new page surface has a target theme set to differentiate against.
- `radical-per-module-theme-variants` — companion jump that adds DOM-shape variants per theme per module.

## Order of operations (recommended slicing)

1. **Account pages first** — most module surface is already shipped; quickest wins. Order: `/account/orders[/id]`, `/account/wishlist`, `/account/searches`, `/account/addresses`, `/account/payments`, `/account/inbox`.
2. **Auth pages** — `/account/signin` / `/account/signup` / `/account/login` / `/account/magic-link` — moderate scope, signup-form module needs design.
3. **Blog** — `/blog` + `/blog/[slug]` — `BlogFeed` already exists; needs a `BlogPost` module + the two system-page registrations.
4. **Marketing landing** — `/welcome` — pure composition over existing modules; mostly removing hand-coded JSX.
5. **Cars** — `/cars` + `/cars/[slug]` — pairs with the ss.com integration jump; `CarsList` module needs the faceted-filter system to land first.

## Out of scope

- Admin pages (`/admin/*`) — not customer-facing; not theme-affected.
- API routes (`pages/api/*`) — server-side handlers, not page surfaces.
- Documentation routes (`/docs/*`) — separate consideration; defer.
