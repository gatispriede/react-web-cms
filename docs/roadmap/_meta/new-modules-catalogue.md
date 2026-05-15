---
name: new-modules-catalogue
description: Catalogue of new section / page / content modules required to support the storefront program — cars vertical, theme-specific modules (restaurant / SaaS / event / agency-portfolio), customer-account modules, and cross-theme shared modules. Agents pick individual modules from the catalogue.
research: see research-findings-2026-05-12.md §3 (car listing anatomy), §4 (per-theme cues)
---

# New modules catalogue

## Goal

Every new public surface in the storefront program plus the per-theme cues from the research needs **new section modules** in our existing module registry. This doc catalogues them all — agents pick individual modules from here and ship them against the standard module contract.

Module contract (already shipped):
- `ui/client/modules/<Name>/<Name>.tsx` — display
- `ui/client/modules/<Name>/<Name>.types.ts` — type contract
- `ui/admin/modules/<Name>/<Name>Editor.tsx` — editor
- Section data lives in `IItem.content` (JSON) — no per-module services
- Registered via the existing module registry; auto-discovered by codegen

Every new module also:
- Carries `data-edit-target` for inline-editing ([admin-inline-editing.md](../admin/admin-inline-editing.md))
- Reads theme tokens via `var(--*)` — no hardcoded colors / sizes
- Honours `--motion-scalar` for animations
- Ships data-testids per naming convention
- Meets WCAG 2.2 AA contrast + keyboard nav + 44 px touch targets

## Cars vertical (Wave 7 — ships with ss.com)

### `CarListingCard`

Hybrid card (4:3 thumbnail left, content right). Used in `/cars` list grid + saved-search alerts + email digests.

Fields: `productId`, `title` (year + make + model), `priceFormatted`, `monthlyPaymentEstimate?`, `mileage`, `fuel`, `gearbox`, `year`, `region`, `vatRegime`, `photoCount`, `thumbUrl`, `dealerVerified?: boolean`, `accidentFree?: boolean`, `imageCount`.

Layout responsive: 4:3 thumb left on desktop / full-bleed image top on mobile. Spec strip uses `<dl>` for accessibility.

Trust badges row: `Margin VAT` / `21% VAT` / `Private seller` / `Verified seller` / `>=10 photos`.

### `CarVehicleDetailPage` (VDP)

Detail page anatomy per [research findings §3](research-findings-2026-05-12.md):

- **Above-the-fold (no scroll):** hero image + title + price + monthly-payment estimate + key spec strip + primary CTA + photo count
- **Photo gallery:** 15-20+ photos, consistent shot order, lazy-loaded below fold, pinch-zoom on mobile
- **Spec table** (`<table>` with `<th scope="row">` for accessibility)
- **Trust strip:** history report, VIN, inspection date, accident-free badge, owner count, dealer rating
- **3-tier CTA hierarchy:** Reserve (primary) / Contact (secondary) / Save to wishlist (tertiary)
- **Similar listings strip** at the bottom (4 cards)
- **Sticky mobile footer bar:** Call / Message / Reserve

Module is composite — internally uses `CarPhotoGallery`, `CarSpecTable`, `CarTrustStrip`, `CarSimilarStrip` sub-modules.

### `CarPhotoGallery`

Full-bleed swipe gallery with thumbnail strip. Pinch-zoom on mobile via CSS `touch-action: pinch-zoom`. Keyboard arrow-key navigation. Lazy-load past first 3 images. Sets `aspect-ratio: 4/3` to reserve layout space.

### `CarSpecTable`

Type-safe rendering of the attribute map → `<dl>` or `<table>` with optional grouping (Identity / Engine / Body / History / Location).

### `CarReservationCta`

Sticky desktop sidebar widget + sticky mobile footer bar. States: available / reserved-by-other / reserved-by-you / unavailable. Calls `order_createReservation` MCP tool.

Acceptance includes: focus-trap on the inline auth-prompt modal, 44 px touch targets, reduced-motion-safe entrance.

### `VatBadge` (cross-vertical — kept here)

Small inline label component (technically a component, not a section module). Color-coded:
- Green: "Private seller — no VAT"
- Blue: "VAT 21% — reclaimable for businesses"
- Amber: "Margin scheme — VAT included, not reclaimable"

Lives under `ui/client/components/VatBadge.tsx` (component, not module) — reused by CarListingCard + CarVehicleDetailPage + Cart line items.

### `CarComparisonTable`

User selects 2-4 cars from `/cars` → opens `/cars/compare?ids=...` → renders side-by-side spec table with row highlighting where specs differ. Calls existing `product_list` to fetch.

### `CarFinanceEstimator`

Stub for v1 — captures interest in financing without quoting (no Latvian banking integration yet). Operator review queue. Form: contact info + preferred monthly payment range → routes to inquiry pipeline.

## Customer account (Wave 6c — ships with signup)

### `AccountDashboardGrid`

The 6-card grid from [client-signup-and-anonymous-checkout.md](../storefront/client-signup-and-anonymous-checkout.md). One module = the whole grid; cards are sub-components with counts pulled from the active customer's data.

### `OrderProgressTimeline`

4-step horizontal stepper (Ordered → Confirmed → Scheduling → Delivered) with dated milestones. Reused in:
- `/account/orders/[id]` detail page
- `orderConfirmation` + `carReservationConfirmation` email templates (via shared markup helper)

Variants per order kind: `sale` (default) vs `reservation-deposit` (Reserved → Verifying → Pickup scheduled → Handover).

### `OrderDetailModule`

Full order detail card — line items + addresses + payment summary + status history + actions (reorder / contact support / cancel-if-allowed). Uses `OrderProgressTimeline` at the top.

### `WishlistGrid`

Grid of saved products with remove button + "Move to cart" (or "Reserve" for cars). Calls `customer_wishlist_*` tools (file a follow-up if wishlist isn't shipped with signup; recommend: ship as part of signup wave or a fast follow-up).

### `SavedSearchList`

Customer's saved searches with last-result-count + alert-cadence indicator + edit/delete. Tappable rows re-open the list with the filter applied.

### `MagicLinkRequestForm` + `MagicLinkConfirmation`

Two modules — request form on `/account/login`, confirmation landing on the email link click ("Click to sign in" with the pre-fetch mitigation pattern).

### `OauthButtonStack`

Stack of "Continue with X" buttons. Order per platform (per [research findings §2](research-findings-2026-05-12.md)): iOS = Apple → Google → Facebook; web/Android = Google → Apple → Facebook. Re-orders by returning-user history when known.

## Theme-specific modules

### Restaurant theme

| Module | Description |
|---|---|
| `RestaurantMenu` | Menu sections + items + dietary badges + price + description + photo. Supports categories (Starters / Mains / Desserts). Mobile: collapsible sections (reuses `mobileBehavior` collapsible pattern). |
| `ReservationWidget` | Date + time + party-size picker → submits to inquiry pipeline OR third-party (OpenTable, Resy, etc.) via a configurable embed URL. v1: inquiry submission only. |
| `OpeningHours` | Day-of-week table with current-day highlighted + "Open now / Closed" status badge derived from system time + timezone. Schema.org `OpeningHoursSpecification` injected. |
| `ContactBlock` | Phone (with click-to-call on mobile) + address (with map link) + email + social. Used by local-business + restaurant. |

### SaaS-landing theme

| Module | Description |
|---|---|
| `PricingTable` | 2-5 plan tiers with feature checkboxes + per-feature tooltips + "Most popular" highlight + CTA per plan. Annual/monthly toggle with savings indicator. |
| `FeatureGrid` | 3-6 feature cards with icon + title + 1-2 sentence description. 2-3 column on desktop, single-column on mobile. |
| `ProductScreenshotHero` | Above-the-fold hero with headline + sub + CTA on left, product screenshot on right (with scroll-driven parallax). Uses `scroll-timeline` where supported. |
| `LogoCloud` | "Trusted by" logo strip — 5-10 customer / partner logos in monochrome with hover-color-reveal. |
| `TestimonialWall` | Multi-column testimonial cards with photo + name + role + company + quote. Different from existing `Testimonials` module (carousel-style); explicitly a wall. |
| `IntegrationGrid` | Visual integration tiles (logo + name + status badge). For SaaS positioning. |
| `ChangelogTimeline` | Reverse-chronological list of product updates with versions + dates. |

### Event theme

| Module | Description |
|---|---|
| `CountdownTimer` | Hero countdown to event date. Days / Hours / Minutes / Seconds. Static end-of-event state. Reduced-motion: static "Starts in N days" string. |
| `EventScheduleAgenda` | Time-grid schedule (rows = time slots, columns = tracks). Filter by track. Mobile: single-column list grouped by day. |
| `SpeakerGrid` | Headshot + name + role + bio popover. Click → modal with full bio + linked social. |
| `SponsorStrip` | Tiered sponsor logos (Platinum / Gold / Silver) at different sizes. |
| `EventBuyTicketsCta` | Sticky bottom-right floating button → modal with ticket tiers + Stripe checkout. v1: links to external ticketing if no native flow shipped. |
| `EventHeroVideo` | Full-bleed background video with overlaid title + countdown integration. Falls back to poster image with `prefers-reduced-motion`. |

### Agency + Portfolio themes

| Module | Description |
|---|---|
| `ProjectCaseStudy` | Long-form scroll-driven case study layout: hero shot → context → process → outcome → metrics → next-case-prompt. Uses `scroll-timeline` for reveals. Used as a *page template*, not a section module — registered as a page type. |
| `ProjectTileGrid` | Grid of project tiles with hover-zoom + caption overlay. Different from existing `ProjectGrid`; this one is masonry-style + hover-cinematic. |
| `BeforeAfterSlider` | Drag-handle slider revealing before/after image pair. Used for design / dev / construction case studies. |
| `MetricsCallout` | Big-number block ("3.2× signup conversion") with description below. Used inside case studies. |
| `ProcessTimeline` | Vertical timeline of project phases with date + description. Different from existing `Timeline` (horizontal); explicitly vertical + project-oriented. |
| `ServicesGridFancy` | Higher-fidelity services grid with motion + icon + hover-state. Different from existing `Services` module (simple list); this one is presentation-grade. |

## Cross-theme shared modules

### `StickyCtaBar`

Sticky bottom bar (mobile) / floating bottom-right (desktop). Configurable CTAs (1-3) with icons + labels + actions. Used by:
- Cars VDP (Call / Message / Reserve)
- Event pages (Buy Tickets)
- Restaurant pages (Reserve a table / Order delivery)
- SaaS-landing (Start free trial)

Mobile: full-width bar with up to 3 buttons. Desktop: dismissable floating button (single primary CTA).

### `ComparisonTable`

Generic side-by-side comparison. Used by:
- Cars (CarComparisonTable wraps this)
- SaaS pricing (PricingTable wraps this — alternative shape)
- Product alternatives

Configurable rows + columns + row-highlighting where values differ.

### `SchemaOrgInjector`

NOT a visible module — a page-level component that emits JSON-LD structured data based on the active page's type. Required for SEO:

- `Product` schema for cars + commerce
- `Article` schema for posts
- `LocalBusiness` schema for local-business / restaurant
- `Event` schema for event pages
- `Organization` schema sitewide
- `BreadcrumbList` schema on detail pages
- `OpeningHoursSpecification` for restaurant / local-business
- `FAQPage` schema for FAQ modules

Each theme can extend the injector with its own per-page-type registrations.

### `OgImageGenerator`

NOT a visible module — a server-side helper that generates Open Graph images on demand:

- Cars: vehicle hero + price + spec strip
- Products: product image + title + price
- Posts: title overlay on cover image
- Pages: title on theme-branded background

Uses `@vercel/og` or equivalent. Cached per content version.

### `SaveSearchPrompt`

In-list module that appears after the user has interacted with filters for >5 seconds. "Save this search?" CTA → opens modal → save → returns to list. Dismissable. Only shown to authed customers.

### `BreadcrumbBar`

Schema.org-aware breadcrumb above the page title. Reads from the current route's parent chain. Mobile: collapses to "← Back" link + current page title.

### `EmptyStateBlock`

Public-side empty states — sibling of admin EmptyState. Used for:
- "No results match your filters" on `/cars` / `/products`
- "Nothing in your wishlist yet"
- "No saved searches"
- "We couldn't find this car (it may have been sold)"

Same component shape as the admin EmptyState; different illustration set.

### `LanguageSwitcher` (already exists; flagging dependency)

Used in headers across all themes. No new work; just confirming it integrates with the new themes' header behaviors.

### `CookieConsentBanner` (forward-stub)

Empty stub today (local POC scope per [project_local_poc_scope](../../C:/Users/User/.claude/projects/D--Work-redis-node-js-cloud/memory/project_local_poc_scope.md)). Component scaffold + props contract in place so Wave 8b drops in the real implementation without restructuring.

## Module support delivered alongside

For every new module, also ship:

- **Sample data** in the seed bundle (so [admin-empty-states-onboarding.md](../admin/admin-empty-states-onboarding.md) shows it after wizard completion)
- **Editor pane** (`ui/admin/modules/<Name>/<Name>Editor.tsx`)
- **i18n keys** in `ui/client/modules/<Name>/i18n/{en,lv,ru}.json` (Latvian + Russian for ss.com market)
- **MCP coverage** through the generic `module_add / update / remove / reorder` tools — no per-module MCP work unless the module has bespoke mutations (e.g. `CarReservationCta` calls `order_createReservation`)
- **Per-theme styling partial** (`ui/client/styles/Themes/<Slug>/_<module>.scss`) for each theme that consumes the module — generally only "headline" themes; default styling covers the rest
- **data-testid coverage** per the naming convention
- **WCAG 2.2 AA passing** — keyboard nav + 4.5:1 contrast both modes + 44 px touch + reduced-motion safe + screen reader friendly
- **Visual baseline** committed after Q4-cap lands

## Effort

This is a **catalogue, not one chunk**. Each module is independently shippable.

Rough AI agent estimates per module:

| Module complexity | Display + Editor + i18n + types + test | Example |
|---|---|---|
| Simple (data → render) | ~1-2h AI | `LogoCloud`, `OpeningHours`, `BreadcrumbBar`, `MetricsCallout`, `SponsorStrip` |
| Medium (interactive but local state) | ~3-4h AI | `PricingTable`, `FeatureGrid`, `ProjectTileGrid`, `RestaurantMenu`, `BeforeAfterSlider`, `EventScheduleAgenda`, `SpeakerGrid` |
| Complex (composite or mutation-driving) | ~6-8h AI | `CarListingCard` (with all its trust badges + responsive), `CarVehicleDetailPage` (composite), `CarReservationCta` (mutation + state machine), `AccountDashboardGrid`, `OrderDetailModule` |
| Page templates (full layout) | ~8-12h AI | `ProjectCaseStudy` (scroll-driven layout) |
| Infrastructure (no UI) | ~2-3h AI | `SchemaOrgInjector`, `OgImageGenerator` |

**Aggregate budget across the catalogue:** ~80-110 AI agent hours, parallelisable per module. Theme-specific modules ship with their parent theme in Wave 5; cars modules with ss.com (Wave 7); customer-account modules with signup (Wave 6c); cross-theme shared modules land opportunistically wherever first needed.

## Acceptance

For each module shipped:

1. Display + Editor + i18n + types + at least one rendering test land in the same PR
2. Theme-aware via `var(--*)` consumption (no hardcoded colors / sizes)
3. WCAG 2.2 AA passing — verified by axe-core in the e2e suite
4. `data-testid` on every interactive element
5. `data-edit-target` on every editable field (for inline-editing dispatch)
6. Reduced-motion safe (animations scale by `--motion-scalar`)
7. Mobile rendering at 375 px verified
8. MCP coverage either through generic `module_*` tools or bespoke tools if the module has unique mutations
9. Sample data appears in the onboarding seed bundle

## Dependencies

- [motion-token-system.md](../admin/motion-token-system.md) — every animated module reads `--motion-scalar`
- [first-class-themes.md](../storefront/first-class-themes.md) — theme-specific modules ship inside their parent theme
- [admin-inline-editing.md](../admin/admin-inline-editing.md) — `data-edit-target` propagation
- Existing module registry + codegen (shipped)

## Open questions

- **[OPERATOR DECISION]** Wishlist scope — ship with signup (M, parallel to it) or as a fast follow-up? Recommend: fast follow-up to avoid bloating the signup chunk.
- **[OPERATOR DECISION]** Restaurant theme reservation integration — first-party form only (v1) or include OpenTable / Resy embeds? Recommend: first-party only; embeds are a per-customer config later.
- **[OPERATOR DECISION]** Event tickets — link to external (Tito / Eventbrite) only, or first-party Stripe checkout? Recommend: external link in v1, native if a real event customer asks.

## Out of scope

- 3D product viewers for commerce theme (heavy dep — model-viewer or Three.js; defer until a commerce customer asks)
- AR / mobile-camera integration (preview cars in driveway etc.) — separate future item
- Real-time presence indicators on modules — separate Presence feature work, not a module concern
- Video conferencing modules (event live-streaming) — separate
