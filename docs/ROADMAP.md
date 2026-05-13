# Roadmap — redis-node-js-cloud CMS

Forward-looking only. Architecture: [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) + the UML at [architecture/data-model.svg](architecture/data-model.svg). Per-item plans + estimates: [`roadmap/`](roadmap/). Shipped archive: [`roadmap/shipped.md`](roadmap/shipped.md).

---

## Status (2026-05-13, late)

- **`origin/develop` HEAD:** `c4b86dc` — commerce + auth track (Phase 0 + Phase 1, 12 jumps) + 32-commit follow-up batch covering Phase-1.D state wiring, motion-token sample migration, BreadcrumbBar enhancements, ~47 new modules across cross-theme primitives + cars vertical + customer-account + restaurant + event themes.
- **`origin/claude/test-lEADs` HEAD:** `3f56f2f` — 5 commits ahead of develop with SaaS-landing (7 modules) + Agency/Portfolio (6 modules) themes + Turbopack global-CSS systemic fix (68 SCSS imports hoisted to `_app.tsx`). **Awaiting develop merge** — last attempt hit HTTP 403 (branch protection); needs manual merge or relaxed permissions.
- **Pending caveats:** optional `@react-pdf/renderer` install (operator decision); `OgImageGenerator` cross-theme primitive (needs `@vercel/og` install, operator decision); preview-samples test fixture stale (2 pre-existing failures unrelated to new work).
- **Operator post-merge ops queued:** email DNS (SPF/DKIM/DMARC), B2+restic, Stripe test keys, ss.com path A/B/C, legal `/privacy`+`/terms`, screen-reader passes, Q4-cap visual baselines.

---

## Architecture skeleton — what every new feature plugs into

A feature added today wires through these primitives — no architectural decisions left to make:

- **Backend**: `<Feature>ServiceLoader extends ServiceLoader` declares services, indexes, SDL, authz, optional `resourceGated` extractors, optional `functionalRoles`, optional `cacheVersionKeys`, optional `batchAccessors`. Plug-and-play toggle controlled by env / Mongo / default. Codegen scans `feature.manifest.ts` and feeds the registry.
- **Frontend (admin)**: `<Feature>AdminUILoader extends AdminUILoader` declares `adminPane: {id, route, modes: {simplified?, advanced}}` + optional `itemTypeEditors`. Registered in `adminUILoaderRegistry.ts`. Mode-aware dispatch is automatic.
- **Frontend (client)**: `<Feature>ClientUILoader` declares `publicRoutes` (auto-applies `withFeatureGate` via `gatePath`) + optional `itemTypes` (Display half of the module registry).
- **Frontend (state)**: `<Feature>ViewModel` extends nothing — plain TS class wrapped by `observable()`. Methods auto-bind, fields trigger re-renders, `useViewModel(() => new VM())` hooks the component. **`useState` is lint-banned in `ui/admin/features/**` (VM4 rule).**
- **Authorization**: rank role + functional roles + per-resource grants (feature / page / locale, intersection semantics) compose through `guardMethods`. Per-request cache is wired. 30 admin mutations grant-gated.
- **Operations**: `markRestartRequired()` for boot-bound config changes. Audit hooks via `runMutation`. Health endpoint at `/api/health` with `bootId`. Cache versions bump automatically when `cacheVersionKeys` are declared. Blue/green deploy supported (gated by `vars.SEAMLESS_DEPLOY`).
- **MCP**: tools that mutate or affect site state are gated as advanced-only via `enforceModeForTool(userId, toolId)`; throws `FeatureRestrictedError` for simplified-mode users.
- **CSS**: per-component SCSS files import from `pages/_app.tsx` (Next 16 / Turbopack rule — see hoisted block at the top of `_app.tsx`). Module SCSS uses BEM + theme tokens (`--accent` / `--ink` / `--theme-borderRadius` / `--motion-scalar`); no hardcoded ms or `cubic-bezier`.

---

## Open queue

### Pre-merge verification (operator action)

Two prod sites need a 1:1 sanity pass before master merges. Bundles exported 2026-05-03:

| Domain | Bundle | Verify against |
|---|---|---|
| **funisimo.pro** | [`public/CV/site-2026-05-03.json`](../public/CV/site-2026-05-03.json) (51 MB) | live site at funisimo.pro |
| **skyclimber** | [`public/Skyclimber/site-2026-05-03.json`](../public/Skyclimber/site-2026-05-03.json) (68 MB) | live skyclimber domain |

Runbook: [runbooks/upgrade-droplets.md](runbooks/upgrade-droplets.md). Smoke checklist: [runbooks/upgrade-smoke-checklist.md](runbooks/upgrade-smoke-checklist.md).

### Forward work — platform & admin

- [F6 — site-mode toggle: scroll vs multipage](roadmap/platform/site-mode-toggle.md) — `siteFlags.siteMode` switch so sites can render as single-page-scroll or multipage-routed. **M** (1-2 days). 4-phase plan in [roadmap/README.md](roadmap/README.md).
- [Admin dark-mode audit](roadmap/admin/admin-dark-mode-audit.md) — screenshot 5 representative admin pages, run through Stitch, fix global-first via AntD ConfigProvider `cssVar: true` tokens. **M** (~1 day). Depends on Q4-cap baselines.
- **Mobile column behavior** — per-module flag (`stack` / `keep-ratio` / `reorder-N`) for multi-column sections on narrow viewports. **S**; needs spec doc.
- **Section + module drag-reorder root cause** — explicit up/down arrow buttons ship as the immediate fix; the underlying drag flow (`getChangedPos` + `DraggableWrapper`) still needs an actual diagnosis. **M**.
- **Visual baseline capture** — `--workers=1` run failed with 1ms instant errors per spec; needs spec-load diagnosis.
- **F8 MCP follow-ups** — streaming transport for bundle/image ops (✅ partly shipped 6c091be), plugin SDK for third-party tools, E2E un-skip post Windows-fanout fix. See [roadmap/platform/mcp-real-world-ready.md](roadmap/platform/mcp-real-world-ready.md).
- **2 lingering `test.skip`s** — Trash restore-flow (Popconfirm OK button needs a stable testid) + idempotency reusable-button (no non-destructive guarded button candidate exists). Low priority.

### Forward work — admin UX (Wave 2.5)

- [admin-command-palette.md](roadmap/admin/admin-command-palette.md) — kbar-style command palette. **M**.
- [admin-empty-states-onboarding.md](roadmap/admin/admin-empty-states-onboarding.md) — operator-grade empty states with illustration set + onboarding wizard tie-in. **M**.
- [admin-permissions-ux.md](roadmap/admin/admin-permissions-ux.md) — grant-grid editor + per-resource overlays. **L**.
- [admin-inline-editing.md](roadmap/admin/admin-inline-editing.md) — `data-edit-target` round-trip from public client to admin overlay. **L**.
- [admin-content-releases.md](roadmap/admin/admin-content-releases.md) — staging + scheduled-publish + rollback. **XL**.

### Forward work — storefront enablers (Wave 6)

- [storefront-receipt-emails.md](roadmap/storefront/storefront-receipt-emails.md) — 9 transactional email templates (magicLink / verifyEmail / passwordReset / orderConfirmation / carReservationConfirmation / inquiryAcknowledgement / scheduledPublishFailed / lowStockAlert / savedSearchAlert) with visual progress timeline + theme-token-driven layout. **M** (~3h AI).
- [storefront-faceted-filter-system.md](roadmap/storefront/storefront-faceted-filter-system.md) — filter chips + URL state + saved-search integration. Consumed by ss.com + the existing `/products` route. **L** (~6-8h AI).
- [client-signup-and-anonymous-checkout.md](roadmap/storefront/client-signup-and-anonymous-checkout.md) — `customer` rank, public `/account/*` routes, magic-link / password / OAuth options, marketing attribution capture, guest checkout via `orderToken`, guest→customer upgrade path. **L** (1-2 weeks). Depends on clean email deliverability.

### Forward work — storefront stretch (blocked on operator decisions)

- [ss.com as product warehouse — cars first](roadmap/storefront/ss-com-cars-integration.md) — **XL** (multi-week). **Blocked on operator acquisition path A/B/C** (partner data licence / public RSS / scrape-off-table). Cars-vertical modules (CarListingCard, CarPhotoGallery, CarSpecTable, CarReservationCta, CarComparisonTable, CarFinanceEstimator, CarVehicleDetailPage, VatBadge) are all shipped and ready to consume the warehouse data when path is selected.
- [Car-parts distributor API research](roadmap/storefront/car-parts-distributor-research.md) — research-only jump (no code until operator picks A/B/C per distributor). Matrix across TecDoc/TecAlliance, Inter Cars, AutoDoc, EBROS, DEPO, AD Auto, Stahlgruber, GROUPAUTO, Allegro, eBay Motors Parts. **M** (~2-3h research AI + operator wall-clock for partner contracts).
- [First-class themes — Stitch-designed, full coverage](roadmap/storefront/first-class-themes.md) — replace 4 token-reskin presets with ≥5 Stitch-designed themes; each ships design doc + frames covering every module type. **XL** (multi-week, parallelisable per theme). Depends on Q4-cap baselines + [logo-style-options](roadmap/content/logo-style-options.md) + [mobile-column-behavior](roadmap/platform/mobile-column-behavior.md).
- **OgImageGenerator** cross-theme primitive — uses `@vercel/og` or equivalent. **Operator install decision pending** (~$0 cost, but adds 1 dep + 1 API route).

### Forward work — pre-public-deploy gates (Wave 8 — ~120-160h AI)

EAA-mandated + operational hygiene before any public-internet deploy:

- [accessibility-wcag22-audit.md](roadmap/storefront/accessibility-wcag22-audit.md) — WCAG 2.2 AA across new storefront surfaces (modules ship 44px tap targets + theme-tokenised contrast; audit closes the gap).
- [gdpr-privacy-consent.md](roadmap/storefront/gdpr-privacy-consent.md) — consent UI, DNT honor, data export, delete-account, PII redaction. `CookieConsentBanner` forward-stub already in tree; Wave 8b drops in the real flow.
- [email-deliverability-hardening.md](roadmap/storefront/email-deliverability-hardening.md) — SPF/DKIM/DMARC, suppression list, warmup. **Operator action required for DNS records.**
- [performance-budget-ci.md](roadmap/platform/performance-budget-ci.md) — Lighthouse + Core Web Vitals + size-limit in CI.
- [backup-and-disaster-recovery.md](roadmap/platform/backup-and-disaster-recovery.md) — Restic + B2 + drill, RPO 6h / RTO 1h. **Operator action: B2 bucket + restic init + passphrase.**
- [customer-notification-preferences.md](roadmap/storefront/customer-notification-preferences.md) — preference center + in-app inbox.
- [multi-currency-and-tax.md](roadmap/storefront/multi-currency-and-tax.md) — FX rates + Stripe Tax + VIES. **Operator action: Stripe keys.**
- [seo-program.md](roadmap/storefront/seo-program.md) — sitemap + OG + schema.org + redirects (the new `SchemaOrgInjector` primitive seeds this).

### Forward work — infra / deploy fragility

- **Deploy auto-rollback on health-check fail** — tag `app:current` before rebuild + restore on health-check failure, or promote `SEAMLESS_DEPLOY=1` to default. **S**.
- **Image registry (GHCR)** — biggest single deploy-fragility win. Cold start 6-8 min → ~30 sec. **M** (~half day), $0-3/mo.
- **Declarative `.env` (split static vs runtime)** — pairs with image-registry. **S**.
- **Terraform droplet + DNS + firewall** — replace imperative SSH bootstrap with `terraform apply`. Multi-droplet provisioning becomes a matrix entry. **L** (1-2 days), $0-5/mo for state backend.
- **Bundle-import → `markRestartRequired()` hook** — set restart banner when imported bundle's language symbol set differs from current `next-i18next.config.js` locales. **S** (1-2 hr).

---

## What landed recently

See [`roadmap/shipped.md`](roadmap/shipped.md) for the full archive. Highlights from 2026-05-13:

- **Commerce + auth track** (`76b1658`) — Phase 0 shared abstractions + Phase 1 (6 main items + 6 deferred sub-jumps), ~520 net-new files, ~50 new MCP tools, ~15 e2e specs.
- **Phase-1.D state wiring** (`fbc5dda`) — 12 locked transactional modules now read live cart + checkout-machine state and wire `OrderApi` end-to-end.
- **47 new modules from the catalogue:** 7 cross-theme primitives (BreadcrumbBar enhancements, EmptyStateBlock, StickyCtaBar, ComparisonTable, SchemaOrgInjector, SaveSearchPrompt, CookieConsentBanner stub), 8 customer-account modules (OrderProgressTimeline, WishlistGrid, SavedSearchList, MagicLinkRequestForm, MagicLinkConfirmation, OauthButtonStack, AccountDashboardGrid, OrderDetailModule), 9 cars-vertical (VatBadge, CarListingCard, CarPhotoGallery, CarSpecTable, CarReservationCta, CarComparisonTable, CarFinanceEstimator, CarVehicleDetailPage, plus the existing Breadcrumb upgrade), 4 Restaurant (RestaurantMenu, ReservationWidget, OpeningHours, ContactBlock), 6 Event (CountdownTimer, EventScheduleAgenda, SpeakerGrid, SponsorStrip, EventBuyTicketsCta, EventHeroVideo), 7 SaaS-landing (PricingTable, FeatureGrid, ProductScreenshotHero, LogoCloud, TestimonialWall, IntegrationGrid, ChangelogTimeline), 6 Agency/Portfolio (ProjectCaseStudy, ProjectTileGrid, BeforeAfterSlider, MetricsCallout, ProcessTimeline, ServicesGridFancy). ~190 new unit tests across the batch.
- **Wave 0 foundational** — motion-token system (Carbon/Material 3 ratios + `--motion-scalar` reduced-motion switch + stylelint warn-only rules + sample migration), admin Sonner toast adoption + Undo affordance, testid-coverage CI script with AST walk + allowlist. All three verified pre-session.
- **Turbopack global-CSS systemic fix** (`3f56f2f`) — Next 16 / Turbopack enforces "global CSS only from `_app.tsx`". Hoisted 68 module SCSS imports to `pages/_app.tsx` as a one-shot fix; per-component `.tsx` files no longer import their own SCSS. Class names + DOM structure unchanged.
- **Car-parts distributor API research roadmap item filed** — `docs/roadmap/storefront/car-parts-distributor-research.md`.
- **Cleanup:** `products/[slug]` rules-of-hooks bug fix; motion-token sample migration across 5 SCSS files (33→24 stylelint warnings).
