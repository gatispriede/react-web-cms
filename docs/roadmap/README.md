# Roadmap plans

One markdown per roadmap item. Each file has the same shape:

- **Goal** — what shipping this means
- **Design** — approach, decisions, data model touches
- **Files to touch** — approximate surface
- **Acceptance** — how we know it's done
- **Effort** — rough time budget (see legend)

The headline [ROADMAP.md](../ROADMAP.md) stays as the short bullet list; these files are the "open this before you start" expansions.

Shipped items live in [`shipped.md`](shipped.md) — kept for archaeology, not active triage.

## Directory layout

Roadmap items are organised by track. Each subdir has its own README listing what's inside.

| Subdir | What lives there |
|---|---|
| [`_meta/`](_meta/) | References + standards + catalogues (not roadmap items themselves) — research findings, project standards, agent-handoff format, MCP coverage catalogue, modules catalogue, target architecture |
| [`storefront/`](storefront/) | Public-facing program: themes, signup, receipt emails, faceted filters, ss.com cars, accessibility (Waves 5-8) |
| [`admin/`](admin/) | Operator-grade admin polish: command palette, content releases, inline editing, dark-mode audit, permissions, empty states, motion tokens, Sonner, mobile-friendly admin (Waves 0-2.5) |
| [`platform/`](platform/) | Infra / MCP / migrations / caching / tooling (Waves 2-4) |
| [`content/`](content/) | Content module + media pipeline polish (image opt, gallery, logo variants, carousel) |
| [`archive/`](archive/) | Historical items kept for archaeology (postmortems, client reports) |
| [`production/`](production/) | Pre-existing production-bootstrap notes (kept as-is) |

Files at this level (`docs/roadmap/`):
- `README.md` — this file
- `shipped.md` — commit-ref archive of completed items
- `backlog.md` — concrete-trigger parking lot for ideas deferred until a real driver emerges

## Universal requirements — every roadmap item

These apply to every active item regardless of size or wave. Treat them as acceptance criteria, not nice-to-haves.

1. **Docs reflect the work.** When an item ships, update — at minimum — the relevant spec doc (mark it shipped or amend), `docs/roadmap/shipped.md`, and any architecture / runbook docs that diverge from the new shape. Inline code comments cover the *why*; markdown docs cover the *where to look first*.
2. **MCP coverage parity for editable surfaces.** Every feature whose content / state / config can be authored through the admin UI must also be manageable via MCP — same operations, same guards. MCP is the canonical write path for AI authoring; admin UI is the human surface on top. New editable field → MCP tool (or extension to an existing tool's schema) lands in the same PR. Read-side parity follows the introspection pattern (`includeUsage` / `includeMissing` / etc. — see [`mcp-bulk-and-introspection.md`](platform/mcp-bulk-and-introspection.md)). Items that touch only infra, tests, or read-only investigations are exempt. **All content management — including products, warehouse inventory, leaf product pages, category pages, system pages, and per-tenant configuration — falls under this requirement.** Reinforced 2026-05-12.
3. **Ship as chunks, not phases.** Each roadmap item is one complete deliverable. No "Phase 1 / Phase 2 / Phase 3" inside an item — that just means three follow-up items, each requiring more context-restoration. If a feature is genuinely too large for one chunk, split it into separately-named roadmap items in `README.md`, each with its own complete acceptance criteria. A chunk lands or doesn't; there's no useful intermediate state to merge. Effort estimates can break down internally (shell ~1.5d, editors ~2.5d, polish ~1d) but those are time-share notes, not separate ship targets.
4. **`data-testid` on every interactive surface.** Any new or modified UI component lands with `data-testid` attributes on every element an e2e test could plausibly target — buttons, inputs, options, list items with identity, modals, drawer toggles, status indicators. Naming convention:
   - **Static elements:** `feature-component-role` (kebab-case) — e.g. `admin-shell-drawer-toggle`, `link-target-picker-search-input`, `themes-pane-bulk-delete-button`.
   - **Items with identity:** `feature-component-{id}` — e.g. `section-row-toggle-{sectionId}`, `link-target-picker-option-{anchorId}`, `gallery-tile-{imageId}`.
   - **State variants:** suffix with `-{state}` when needed — e.g. `section-row-toggle-{id}-expanded`. Prefer toggling a class + asserting via `[data-testid="..."][data-state="expanded"]` over compound testids.
   - **Mode dispatchers (AUI):** prefix with the mode — e.g. `themes-simplified-card-{themeId}` vs `themes-advanced-card-{themeId}` — so e2e specs can target either variant unambiguously.

   E-commerce sweep (shipped 2026-05-03) is the reference precedent: `data-testid` wired across Products / Orders / Storefront / Cart / Checkout. Same conventions apply to every new component going forward.

All four are CI-checkable:
- The schema-drift CI (`tools/scripts/mcp-schema-drift.mjs`) already fails when a GraphQL arg lands without an MCP tool update.
- Add follow-up CI steps: (a) any merged feature commit must touch at least one `docs/` markdown OR pass an explicit "no docs needed" gate in the PR description; ~~(b) `tools/scripts/testid-coverage.mjs` (new) walks new/modified `.tsx` files and warns when an interactive element (`button`, `input`, `Select`, `Modal`, etc.) lacks `data-testid`.~~ **(b) shipped 2026-05-14** — `tools/scripts/testid-coverage.mjs` AST-walks changed `.tsx` files and the PR-only `data-testid coverage` step in `ci.yml` hard-fails on any missing `data-testid`. See [shipped.md](shipped.md).

## Effort legend — AI-paced

Estimates target **focused AI implementation** (Claude Code with full tool access, single-developer review cycle). Wall-clock time on deploys, real-device QA passes, and user-decision pauses adds to total elapsed time but doesn't change the AI work budget.

| Size | AI budget | Reality | Pre-AI human equivalent |
|------|-----------|---------|------------------------|
| XS   | < 15 min  | Trivial edit, single file, no tests | < 1 h |
| S    | 15-60 min | Focused change, 1-3 tests | 1-3 h |
| M    | 1-3 hours | Cross-file, 5-15 tests, design call required | 0.5-1 day |
| L    | 3-8 hours | New surface or migration, 15-40 tests, multi-iteration | 1-3 days |
| XL   | 1-3 days  | Architectural — break down further before starting | 1+ weeks |

**Calibration evidence** from shipped + this session:

| Item | Old estimate | Actual AI ship | Multiplier |
|------|--------------|----------------|------------|
| Image MCP extensions (`391e45f`) | M (3d human) | ~45 min | ~32× |
| Sitemap fix (`be63587`) | — | ~30 min | — |
| F8 MCP 38→87 tools | XL (2-3w human) | ~2-3d AI | ~6-7× |
| F7 slug source-of-truth | — | ~half-day AI | ~5× |
| F2 idempotency + cascade + posts | (full day each, human) | same day combined | ~3-5× |

Patterns: mechanical work (bulk extensions, schema additions, test scaffolding) compresses 10-30×. Decision-heavy work (architecture, unknown-bug debugging) compresses 3-5× — the AI bottleneck shifts to review cycles, not throughput. Deploy waits + on-device QA don't compress.

## Current status (2026-05-04, late)

- **Last master merge:** `2c7be30` (prod-mode smoke + Next 16 dev fixes + themed errors + admin click-parent + F7 sweep + Hero portrait dimension inputs).
- **PROD HOTFIX inbound on develop:** `0390491` — `--webpack` flag on `next build` (`build`, `build-docker`, `start-docker`). Production deploys to funisimo.pro / skyclimber.pro failed health checks because Next 16 defaults `next build` to Turbopack, which rejects the existing `webpack:` block in `ui/client/next.config.js`. Pinning `--webpack` keeps the config honoured. **Awaiting PR develop → master → redeploy.**
- **Develop ahead of master by 7 commits** (one prod-blocker + admin polish + CI-only):
  - `0390491` prod hotfix `--webpack` ← merge first
  - `3959851` admin mode switcher hard-reloads after flip
  - `a12c7b6` unified `[label] [edit] [up] [down] [delete]` action strip
  - `576b212` section-level reorder + module-cluster reposition (superseded by `a12c7b6` but harmless)
  - `cc306a7` initial per-module up/down arrows + label
  - `9373e02` drop master-push trigger from visual regression CI (no baselines yet)
  - `43409e7` smoke spec uses native DOM click on bundle-import confirm (CI flake fix)

## Open queue

### Content editor

| # | Item | Size | Notes |
|---|------|------|-------|
| C13b | link-target stable-anchor — Manifesto only | S (~30 min AI) | Timeline portion shipped 2026-05-03. Manifesto still needs a per-row anchor model (single body paragraph today, no row identity) |
| C17 | field-level sample audit (parked in [backlog.md](backlog.md)) | S (~30 min AI) | Broad per-EItemType coverage already exists; open when a client surfaces a specific gap |
| ~~F6~~ | ~~[site-mode-toggle.md](platform/site-mode-toggle.md)~~ | M (~2h AI) | **Shipped 2026-05-14** — as `siteFlags.layoutMode: 'tabs'\|'scroll'\|'auto'` (`'tabs'` ≡ spec `'multipage'`). Flag + admin Radio.Group + nav/footer mode-aware rendering + `app.tsx` render branch + `site.setLayoutMode` MCP tool + runbook. See [shipped.md](shipped.md). |
| Mobile column behavior | [mobile-column-behavior.md](platform/mobile-column-behavior.md) | S (~1h AI) | **Section-level** `ISection.layout.mobileBehavior: 'stack'\|'collapse'\|'keep-ratio'`. `'collapse'` uses drawer-style accordion with chevron-rotate, mirroring the existing public-side `MobileNav` pattern (consistent gesture across the mobile UX). Shared `@mixin section-row-collapsible` in `ui/client/styles/Common/_responsive.scss` — reused by the Mobile-friendly admin chunk so both surfaces collapse the same way. Visual reference: impeccable design plugin's collapsible-content patterns. |
| Bundle-import restart | bundle-import → `markRestartRequired()` hook | XS (~15 min AI) | Currently a successful import doesn't surface the "restart to pick up new modules" hint. Wire through the existing flag |
| Section drag-reorder bug | original report; up/down arrows are the workaround | S-M (~1-2h AI) | Drag-reorder for both sections and per-module rows stopped working. Up/down + label cluster (`a12c7b6` + `cc306a7`) is the user-facing fix. Root cause investigation finds why `getChangedPos` + `DraggableWrapper` chain stopped firing. |
| Mobile-friendly admin | [mobile-friendly-admin.md](admin/mobile-friendly-admin.md) | L (~6-8h AI + on-device QA) | Operator-grade editing on a phone. Shell drawer + editor row collapse + image tray + PWA + presence + pull-to-refresh shipped together as one chunk. Reuses the shared `@mixin section-row-collapsible` from the public-side mobile column work. Acceptance: full content-edit round-trip on mobile Safari without horizontal scroll. |
| Terraform + Kamal migration | [terraform-kamal-migration.md](platform/terraform-kamal-migration.md) | L (~6-8h AI + cutover wall-clock) | Single chunk that replaces the bash deploy stack end-to-end: Terraform-imported infra + GHCR-built images + Kamal app deploy + cutover of both droplets. Subsumes the previously-separate Image-registry / Declarative-env / Terraform-droplet items — splitting created half-migrated states. Eliminates 6-8min cold deploys and the entire 250-line inline ssh script. |
| Auth split (client vs admin) | [auth-split-client-admin.md](platform/auth-split-client-admin.md) | L (~6-8h AI) | Split admin auth from customer auth into two NextAuth instances with disjoint cookies (`cms.admin-session` `Path=/admin` vs `cms.customer-session` `Path=/account`), disjoint provider lists (admin: credentials + Google + SSO; customer: magic-link + Google + Facebook + Apple), disjoint signin pages (`/admin/signin` credentials-first; `/account/signin` magic-link-first). Adds `siteFlags.clientLoginEnabled` master switch + per-provider sub-toggles. When flag is on, storefront auto-grows login UI: `<CustomerAccountDropdown>` in header, `<AccountLinks>` in footer, `<LoginCta>` in checkout, `<SignupBanner>` op-dismissable, magic-link request form in order-by-token page. When off, **zero** auth surface — `/account/*` 404s via middleware, sitemap omits, robots.txt disallows. Migrates W6c customer-magic sessions to the new instance. 5 new storefront components + 4 MCP tools (`auth.config.get/set`, `auth.providers.list`, `auth.session.invalidate`) + 3 e2e specs. Per-theme `auth.scss` slot in each first-class theme. |
| Product module + checkout customization | [product-module-and-checkout-customization.md](storefront/product-module-and-checkout-customization.md) | XL (~3-5 days AI; recommended split into 4 sub-jumps) | New first-class `Product` content module with 5 variants (featured / grid / carousel / comparison / related) operators can compose into any page like Hero/Manifesto/Gallery. Paired with `siteFlags.checkoutEnabled` master switch + `siteFlags.checkout` customization config (single-step vs multi-step flow, per-field required/optional/hidden, per-provider sub-toggles for Stripe/PayPal/Klarna/BankTransfer/CashOnDelivery, operator-defined `IShippingMethod[]`, compact/detailed order-summary template, post-purchase redirect modes, abandoned-cart recovery via W8f notifications). When `checkoutEnabled === false`, `<BuyCta>` / `<CartDrawer>` / `<AddToCartButton>` all render `null` + `/checkout/*` 404s via middleware + sitemap excludes — site becomes catalogue-only. Mirrors auth-split pattern exactly. 9 new MCP tools + admin Checkout Settings + Shipping Methods panes + 4 e2e specs + abandoned-cart email template + per-theme `Product` module-styles slot. |
| Products as composable page | [products-as-composable-page.md](storefront/products-as-composable-page.md) | XL (~3-4 days AI; recommended split into 3 sub-jumps) | Refactor `/products`, `/products/[category]/[subcategory]/...` onto the `IPage` framework. New `IPage.source = 'warehouse-derived'` discriminator + `WarehousePageSyncWorker` cron + `CategoryTemplate` / `ProductDetailTemplate` defaults. **Removes the 3-layer sub-page depth cap** — real taxonomies need 4-6 levels (`Cars > Used > Sedan > BMW > 3-Series > 2018 330i xDrive`). N-deep slug resolution via Mongo compound index; admin tree-view virtualized at expansion; sitemap-index split (W8h) handles 10k+ derived pages. Operator overrides preserved across worker re-runs (sections beyond auto-template fingerprint are operator-managed). Auto-301 on warehouse-side category rename via W8h redirects. 3 new modules (ProductDetailHero, ProductSpecTable, Pagination) + WarehouseSyncPanel + 4 MCP tools + 2 e2e specs. Pairs with product-module-and-checkout-customization (uses Product mode=grid in auto-injected sections). |
| Checkout as composable page | [checkout-as-composable-page.md](storefront/checkout-as-composable-page.md) | L (~2-3 days AI) | Refactor `/cart`, `/checkout/{address,shipping,payment,confirmation}`, `/account*`, `/orders/[token]` onto `IPage.source = 'system-page'`. Each page gets a default `defaultLayout` + N **locked required transactional sections** (CheckoutAddressForm, CheckoutPaymentForm, PlaceOrderButton, etc.) operators cannot delete + unlimited composable sections around them (TrustBadges, MoneyBackGuarantee, ShippingCalculator, DownloadInvoiceButton, ReferAFriendCta, SocialShareButtons, UpsellRelatedProducts, MagicLinkAccountUpgrade). Reset-to-default action with Sonner Undo. Lock-icon UI affordance in section editor. System pages auto-`noindex` + excluded from sitemap. 5 MCP tools (`systemPages.list/get/update/reset/preview`); update rejects edits to locked sections. 2 e2e specs. Depends on products-as-composable-page (source discriminator), product-module-and-checkout-customization (drives flow shape), auth-split-client-admin (gates `/account*`). |
| Client account settings page (dual type) | [client-account-settings-page.md](storefront/client-account-settings-page.md) | L (~4-6h AI) | Unified `/account/settings` composable system page with tabs (Profile / Security / Addresses / Payment / Notifications / Privacy / Language). **`IUser.customerType: 'client' \| 'company'`** dual account type — client = individual; company = legal name + entity type + VAT (W8g VIES auto-verified) + billing address ≠ shipping + contact person. Type switcher with confirmation modal + audit logging. Signup gains optional B2B toggle (defaults `client`). Checkout pre-fills VAT + billing-vs-shipping from company profile; W8g reverse-charge applies. Per-tab toggles let operators hide tabs (e.g., Payment when checkout off; Security when no password auth). Mirror-symmetric to admin settings but on customer auth stack (auth-split-client-admin). 5 MCP tools + 2 e2e specs + per-theme `auth.scss` styling. Multi-user per company explicitly deferred. |
| Product display templates | [product-display-templates.md](storefront/product-display-templates.md) | L (~6-8h AI) | `IProductTemplate` library — operator-defined named section compositions (Premium / Standard / Quick-buy / Bundle / B2B-spec-sheet) that products reference via `IProduct.templateId`. 5 built-in templates ship as JSON seeds; operators duplicate + customize via section editor (same one used for pages). Admin pane with create/edit/duplicate/preview-against-fixture/delete (cascade resets products to default). Template applies as default; per-product override (from products-as-composable-page) beats template. Section data binding via `ProductContext`. **4 new modules**: LargeGallery / SubProductsGrid / DownloadablePdf / WarrantyInfo. Per-theme `product-templates.scss` slot. 8 MCP tools (`productTemplate.*` + bulk `product.template.set`). Operator filters templates via `applicableTo.categories/sources` + `audience: 'b2c'\|'b2b'\|'either'`. Solves "every product page looks the same" + B2B/B2C visual variety per product. |

### Foundational references (read these first)

| # | Item | Size | Notes |
|---|------|------|-------|
| MOT | [motion-token-system.md](admin/motion-token-system.md) | S (~1h AI) | CSS custom properties on Carbon / Material 3 motion-token shape. `--motion-scalar` gates `prefers-reduced-motion` globally. Foundational — first-class themes + admin animations consume it. |
| STD | [project-standards-additions-2026-05-12.md](_meta/project-standards-additions-2026-05-12.md) | — | Reference doc cataloguing **14 new standards** (Sonner / kbar / dnd-kit / motion tokens / design-token hierarchy / light-dark / cssVar / WCAG 2.2 AA / 44 px touch / container queries / EmailService.sendTemplated / data-edit-target / **§13 jumps-not-iterations delivery philosophy** / **§14 AI-agent-unit estimates only**). |
| AHF | [agent-handoff-format.md](_meta/agent-handoff-format.md) | — | Template + 9 starter-code patterns (Pattern A-I) that every active roadmap item paste-uses. |
| RES | [research-findings-2026-05-12.md](_meta/research-findings-2026-05-12.md) | — | Consolidated research source-of-truth. Cite, don't re-derive. |
| MCP | [mcp-coverage-storefront-program.md](_meta/mcp-coverage-storefront-program.md) | catalogue, ~6-8h AI distributed | Comprehensive MCP tool catalogue for every new editable surface. Each tool ships with its parent roadmap item; this is the parity gate. |
| MOD | [new-modules-catalogue.md](_meta/new-modules-catalogue.md) | catalogue, ~80-110h AI distributed | All new modules needed: cars vertical, customer account, restaurant / SaaS / event / agency / portfolio themes, cross-theme shared. Each module is an independent jump. |

### Design & themes

| # | Item | Size | Notes |
|---|------|------|-------|
| FCT | [first-class-themes.md](storefront/first-class-themes.md) | XL (multi-week, parallelisable per theme) | **8 themes (revised from 5 after research):** editorial / agency / commerce / local-business / restaurant / saas-landing / event / portfolio. Each ships light + dark via `light-dark()`, design doc, theme.json, per-theme SCSS layer (net-new), header+logo treatment, footer styling, scroll-driven animations, per-module styling pass, mobile parity. Stitch = structural draft only (research confirmed 70-90% accuracy, no token export, no animations). Retire simpleton presets after ≥3 first-class themes ship. |
| DM-audit | [admin-dark-mode-audit.md](admin/admin-dark-mode-audit.md) | M (~1 day) | Step 1 = enable `cssVar: true` (currently off; load-bearing). Then screenshot 5 admin pages × 2 modes → Stitch punch list → global AntD token fix → migrate `[data-admin-theme="dark"]` SCSS to `var(--ant-color-*)` → per-feature stragglers → commit baselines. |
| MTS | [motion-token-system.md](admin/motion-token-system.md) | S | (see Foundational) — gates first-class-themes' per-theme animation work |
| A11Y | [accessibility-wcag22-audit.md](storefront/accessibility-wcag22-audit.md) | L (~1-2 weeks AI) | WCAG 2.2 AA across all public surfaces. axe-core in e2e + Pa11y batch + Lighthouse ≥95. Per-theme audit gate. **Pre-public-deploy blocker** — EU EAA legally required from 2025. |

### Admin UX robustness (research-driven)

| # | Item | Size | Notes |
|---|------|------|-------|
| ~~SON~~ | ~~[admin-toast-system-sonner.md](admin/admin-toast-system-sonner.md)~~ | S (~30-60 min AI) | **Shipped 2026-05-14 (W0c)** — toast infrastructure: `sonner@^1.7.4` + `ui/admin/lib/notify.ts` wrapper (`notifySuccess`/`notifyError`/`notifyWarning`/`notifyInfo`/`notifyPromise`/`notifyDestructive`) + dark-mode-aware `AdminToaster` mounted once in the shell. Call-site cleanup (last `message.*` purge, `notifyPromise`/`notifyDestructive` adoption per pane, ESLint guard, e2e) deferred as mechanical per-pane follow-ups. See [shipped.md](shipped.md). |
| ~~CMD~~ | ~~[admin-command-palette.md](admin/admin-command-palette.md)~~ | M (~2-3h AI) | **Shipped 2026-05-14** — kbar ⌘K palette, auto-populated from `adminUILoaderRegistry.listAdminPanes()`, `KBarProvider` mounted shell-wide, top-bar trigger, `?` cheatsheet, `g h/p/t` chords, mobile FAB. Per-feature `useRegisterActions` (⌘S/⌘↵/⌘⇧P/`/`) deferred to per-pane fast-follow. See [shipped.md](shipped.md). |
| ~~INL~~ | ~~[admin-inline-editing.md](admin/admin-inline-editing.md)~~ | L (~4-6h AI) | **Shipped 2026-05-14** — `data-edit-target` round-trip closed: public-element click in admin mode → in-place quick-edit drawer (`modules`/`sections`) or deep-link to the editor pane with `?focus=`/`?editId=` (`pages`/`posts`/`products`). As-built has no preview iframe (build view renders in-place). Per-pane `?focus=` consumption deferred as mechanical follow-ups. See [shipped.md](shipped.md). |
| ~~EMP~~ | ~~[admin-empty-states-onboarding.md](admin/admin-empty-states-onboarding.md)~~ | M (~2-3h AI) | **Shipped 2026-05-14** — operator-grade `EmptyState` (15-key inline-SVG illustration set keyed per surface + `art` prop + `onboardingCta()` deep-link helper into the first-run wizard) wired across 16 admin empty-state surfaces; `onboardingCta` secondary on Posts / Products / Users. First-run wizard + seeded sample bundle already shipped (Q7). See [shipped.md](shipped.md). |
| REL | [admin-content-releases.md](admin/admin-content-releases.md) | XL (~2-3 days AI) | First-class `Release` entity: group N drafts → preview at perspective → publish atomically → rollback. 2025 Sanity differentiator vs Strapi / Payload / Contentful. |
| PRM | [admin-permissions-ux.md](admin/admin-permissions-ux.md) | L (~5-6h AI) | 4 named tiers (Full / Edit / Comment / View) + role presets + groups, replacing per-action checkbox grid. Notion 3.0 + Webflow pattern. |

### Storefront / commerce

| # | Item | Size | Notes |
|---|------|------|-------|
| ~~FFS~~ | ~~[storefront-faceted-filter-system.md](storefront/storefront-faceted-filter-system.md)~~ | L (~6-8h AI) | **Shipped 2026-05-14** — filter-state lib (`ui/client/lib/facetedFilter/`: URL codec + `useFilterState` + chips + saved-search store + per-route configs) + chip/facet-control UI (`ui/client/components/FacetedFilter/`) + `/products` wired as reference consumer (sidebar + pinned chips + live counts + shareable URL state). `/cars` URL-sync + server `$facet` aggregation + saved-search server backend/worker/MCP + mobile drawer deferred. See [shipped.md](shipped.md). |
| EML | [storefront-receipt-emails.md](storefront/storefront-receipt-emails.md) | M (~3h AI) | Receipt + transactional emails as a product surface. Visual progress timeline (high-AOV anxiety reducer), one focused CTA, mobile-first markup. Theme-aware tokens. |
| ~~Signup~~ | ~~[client-signup-and-anonymous-checkout.md](storefront/client-signup-and-anonymous-checkout.md)~~ | M-L (~5-7 days AI) | **Shipped 2026-05-14 (W6c)** — delayed account creation as the only checkout default (no choice screen; `MagicLinkAccountUpgrade` locked section on the receipt page), magic-link cross-device pre-fetch mitigation (click-to-confirm `verify.tsx` + 15-min single-use sha256-hashed tokens), first-touch/last-touch UTM attribution with anonymous→identified merge. Verification pass confirmed all three spec gaps already closed. See [shipped.md](shipped.md). |
| ss.com | [ss-com-cars-integration.md](storefront/ss-com-cars-integration.md) | L (~1-2 weeks AI) | **Collapsed from XL** — Inventory + adapter system is already shipped; ss.com is one new `IWarehouseAdapter` (`SsComCarsAdapter`). **Reservation, not D2C checkout** (research-binding — Cazoo / Vroom failure mode avoided). Marketplace-style anonymous inquiry → account at deposit (€100-200, 48-72h hold). VAT regime as listing fact. Path-segment URL crawl against committed fixtures (no API exists). Per-theme car surfaces in commerce theme. |

### Bulk migrations

| # | Item | Size | Notes |
|---|------|------|-------|
| AUI-mode | [aui-mode-hierarchy.md](admin/aui-mode-hierarchy.md) | M (~1-2h AI per chunk) | Hierarchy decided 2026-05-07: **simplified is the base; advanced composes simplified + extras**. Both variants co-located under `ui/admin/features/<Name>/` (no parallel hierarchy). Lazy-loaded so simplified mode never downloads advanced. Optional site-flag gating per advanced sub-feature. Foundational chunk: refactor Themes + Posts onto inheritance shape + ESLint rule + lazy-load convention (~1-2h AI). Each future pane onboarding (Navigation → Modules → Inquiries → Languages → Bundle → Users → SEO) is its own ~1-2h AI roadmap item, picked up by demand. |

### MCP — F8 deferred

| # | Item | Size | Notes |
|---|------|------|-------|
| F8-stream | streaming transport for bundle/image tools | M (~2h AI + 30min SDK check) | Long-running tools (bundle export, image rescan) currently buffer; streaming progress events queued for post-merge |
| F8-e2e | un-skip MCP E2E suite | S (~30-60 min AI) | Spec exists; `test.skip` blocks pending fixture wiring |
| F8-bulk-introspection | [mcp-bulk-and-introspection.md](platform/mcp-bulk-and-introspection.md) | M (~2-3h AI) | Two parallel gaps. **Bulk-write**: extend ~12 mutation tools (`section.update`, `module.add/update/remove`, `page.update`, `post.upsert`, `product.create/update`, `permission.grant/revoke`, `user.setRole/update`, `translation.delete`, `trash.restore/purge`) with optional `items[]` / `ids[]` arrays. Reference impl: `image.delete { ids[] }` shipped 2026-05-07 (~45 min AI). **Introspection**: extend ~10 `*.list` tools with aggregating flags (`i18n.listLanguages { includeMissing }` for translation gap analysis, `theme.list { includeUsage }`, etc.). Reference impl: `image.list { includeUsage }` same day. Plus `i18n.diff` + `i18n.scanCodebase` translation-specific helpers. Same shared scanner pattern as `ImageUsageService` so admin UI's "show unused / missing" filters reuse the backend. |

### Visual + observability

| # | Item | Size | Notes |
|---|------|------|-------|
| Q4-cap | initial visual baseline capture | S (~30 min AI + capture-run wall-clock) | `npm run e2e:isolated -- tests/e2e/visual/ --update-snapshots` once port 80 is free, then commit `tests/e2e/visual/__snapshots__/`. Also pin the 1ms instant-fail diagnosis |
| Q5-del | admin-segregation Phase 3 deletion | XS (~15 min AI) | After ≥ 1 release cycle of zero `scope: legacy-route` hits in errors panel, drop the three legacy pages + middleware + redirect entries (see [runbook](../runbooks/admin-segregation-phase3.md)) |

### E2E backlog

| # | Item | Notes |
|---|------|-------|
| 1 | ~~E-commerce real-flow specs~~ | **Shipped** 2026-05-03 — `tests/e2e/ecommerce/{products,cart,checkout,inventory,orders}.spec.ts`. 15 happy-path tests across 5 files; no skips, no fixmes. Verified via Wave 2 audit 2026-05-08. |
| 2 | ~~Themes direct-route gqty~~ | **Shipped** 2026-05-08 — confirmed `services/api/client/ThemeApi.ts` `listThemes()` already routes around the cold-load bug via raw POST to `/api/graphql`. `getActive()` uses module-level 30s cache primed by SSR / SPA navigation so the cold-load path doesn't bite. Documented in-file with the same comment style as Platform/Users/Observability panes. No further action — workaround pattern is the canonical fix until the upstream gqty cold-load resolves. |
| 3 | gqty schema regen | Run `npm run generate-schema` to surface `isFreshInstall` / `onboardingBootstrap` to typed clients (the Q6 prebuild check covers production builds; this is for dev iteration) |

## Reference docs

- [target-architecture.md](_meta/target-architecture.md) — naming conventions + top-level layout the reshape landed on. Open this before proposing structural changes.
- [migration-mapping.md](_meta/migration-mapping.md) — full old→new path table from the N15 reshape. Useful when chasing a stale import in docs / legacy notes.
- [shipped.md](shipped.md) — archive of completed items with commit refs.

## Suggested ordering — big to small (2026-05-12, post-research)

Five reality shifts:

1. **Local POC scope is explicit** — GDPR / consent / PII deferred to pre-public-deploy ([memory note](../../C:/Users/User/.claude/projects/D--Work-redis-node-js-cloud/memory/project_local_poc_scope.md)). Compliance work is no longer dragged into v1 acceptance for any item.
2. **Storefront direction is a real track** — four original items (themes / dark mode / signup / ss.com) expanded into the storefront program. Research surfaced **6 more high-ROI items** (Sonner, command palette, inline editing, empty states, content releases, permissions UX, receipt emails, faceted filter system, motion tokens, WCAG audit).
3. **Architecture verification (2026-05-12)** shrunk three of the original four items materially:
   - **`IUser.kind = 'customer'`, `CustomerAuthService`, `IOrder.{guestEmail, orderToken}`, Cart + Checkout, NextAuth credentials + Google OAuth all already shipped.** Signup = "complete UX + add magic-link + attribution," not "build from scratch."
   - **`IProduct.source = 'manual' | 'warehouse'`, `externalId`, `attributes` already exist.** ss.com ingest writes `source: 'warehouse'` + `externalId` + car fields. **Zero `IProduct` schema change.**
   - **Inventory + adapter system already shipped with 12 adapters.** ss.com is one new `IWarehouseAdapter`. **Collapsed from XL → L.**
   - **`ThemeService.bootstrap()` already loads JSON presets.** Per-theme SCSS layer + design docs + Stitch frames = net-new; loader = reuse.
   - **`cssVar: true` is NOT yet on AntD `ConfigProvider`** — load-bearing prerequisite for dark-mode audit + first-class themes' per-theme SCSS.
4. **Research validated key trade-offs**:
   - Forced account creation = **26% cart abandonment** → guest-default is the only acceptable checkout
   - Cazoo collapsed May 2024 with £260M debt → **reservation, not D2C checkout** for cars
   - ss.com has **no API, no partner program** → fixture-driven dev + rate-limited HTML crawl post-operator-approval
   - **8 themes, not 5** — add Portfolio + Restaurant; differentiate agency vs SaaS hard
   - WCAG 2.2 AA **legally required in EU from 2025** (EAA / EN 301 549)
5. **Project standards expanded** — 12 new standards added (see [project-standards-additions-2026-05-12.md](_meta/project-standards-additions-2026-05-12.md)). Each lands with the roadmap item that introduces it; older code migrates opportunistically.

**Delivery philosophy (binding):** Per [project-standards §13](_meta/project-standards-additions-2026-05-12.md#13-delivery-philosophy--jumps-not-iterations), every roadmap item is **one jump = one PR**. No phase 1 / phase 2 within an item; if it doesn't fit one jump, split into named sub-items. WIP working tree may go red; tests + e2e at PR-open is the gate. AI estimates only — no man-days mixed in (per §14).

**Three coordinated tracks now run in parallel:**

- **Platform track** — Waves 1-4: admin polish, MCP coverage, observability, mobile, deploy. Mostly mechanical; AI-pace.
- **Admin UX track** — Wave 2.5 (new): Sonner, command palette, inline editing, empty states, content releases, permissions UX. High-ROI compounds — each lifts perceived quality of the whole admin.
- **Storefront track** — Waves 5-7: design system overhaul, public auth, third-party inventory ingest. Multi-week per item; design-heavy; operator decisions on data acquisition + branding.

**Shared prerequisites** (lands before any track-specific wave):

- **Q4-cap visual baselines** — gates Wave 1 Mobile-friendly admin AND every storefront item
- **Motion token system** — gates first-class themes' animation work + per-feature motion adoption
- **Project standards adoption** — Sonner / kbar / dnd-kit / cssVar / motion-tokens — items land standards opportunistically; no big-bang sweep

Strict size-first ordering within each track; dependencies override size-order where flagged.

---

### Wave 0 — Foundation (do this first, before everything else)

0a. **Q4-cap visual baselines** — **S · ~30 min AI + capture-run wall-clock.** Promoted from Wave 3 because 6 downstream items need it: Mobile-friendly admin, dark-mode audit, first-class themes, ss.com cars, accessibility audit, content releases.

0b. **Motion token system** — [motion-token-system.md](admin/motion-token-system.md). **S · ~1h AI.** CSS custom properties; `--motion-scalar` gates `prefers-reduced-motion`. Foundational — first-class themes consume it; admin animations migrate opportunistically.

0c. ~~**Sonner adoption**~~ — [admin-toast-system-sonner.md](admin/admin-toast-system-sonner.md). **S · ~30-60 min AI. Shipped 2026-05-14** — `sonner@^1.7.4` + `ui/admin/lib/notify.ts` wrapper + dark-mode-aware `AdminToaster` mounted once in the shell. Call-site cleanup deferred as mechanical per-pane follow-ups. See [shipped.md](shipped.md).

0d. ~~**testid-coverage CI**~~ — [testid-coverage-ci.md](platform/testid-coverage-ci.md). **S · ~1 h AI. Shipped 2026-05-14** — AST-walk script (`tools/scripts/testid-coverage.mjs` via `@typescript-eslint/parser`) + unit-test fixture + allowlist + PR-only hard-gate CI step. Closes the only universal-requirement gate without automation. Catches missing `data-testid` at PR time across all 44+ new modules landing in Waves 5-7. See [shipped.md](shipped.md).

Wave 0 total: ~2 hours AI. Land these before anything else; they all gate later items + cost almost nothing.

### Wave 1 — Platform L (3-8h AI, ship as chunks)

1. **Mobile-friendly admin** — [`mobile-friendly-admin.md`](admin/mobile-friendly-admin.md). **L · ~6-8h AI work + on-device QA wall-clock.** Shell drawer + editor row collapse + image tray + PWA + presence + pull-to-refresh as one chunk. Reuses SCSS mixin from Wave 3 mobile column work — schedule mobile column either before or in parallel. AI doesn't compress the real-phone QA passes (iOS Safari + Android Chrome).
2. ~~**Terraform / Kamal migration (funisimo)**~~ — **Shipped 2026-05-08.**

### Wave 2 — Platform M (1-3h AI, ship as chunks)

3. **F8-bulk-introspection** — [`mcp-bulk-and-introspection.md`](platform/mcp-bulk-and-introspection.md). **M · ~2-3h AI.** Bulk-write + introspection + scanners + translation helpers as one chunk. Unblocks translation work + bulk authoring via MCP.
4. ~~**F6 site-mode-toggle**~~ — **Shipped 2026-05-14.** As `siteFlags.layoutMode: 'tabs'|'scroll'|'auto'` — flag + admin Radio.Group + nav/footer mode-aware rendering + `app.tsx` render branch + `site.setLayoutMode` MCP tool + runbook. See [shipped.md](shipped.md).
5. **Admin dark-mode audit** — [`admin-dark-mode-audit.md`](admin/admin-dark-mode-audit.md). **M · ~1 day AI.** **Step 1 is enabling `cssVar: true` on `ConfigProvider`** (currently off — `ui/admin/shell/AdminApp.tsx:243-246`); without it, the existing `[data-admin-theme="dark"]` SCSS and the AntD ConfigProvider are two parallel systems and the audit is fighting both. Then: screenshot 5 pages × 2 modes → Stitch punch list → global AntD token fix pass → migrate the dark-theme SCSS to `var(--ant-color-*)` → per-feature stragglers → commit baselines. Cheap quality-bar fix; pairs with Wave 5 since first-class themes' per-theme SCSS layer needs `cssVar: true` for token consumption.
6. **F8-stream** — **M · ~2h AI** + ~30 min SDK SSE check up front. Streaming transport for `bundle.export` / `image.rescan`. Pair with mcp-rollout #12.
7. **Section drag-reorder root cause** — **S-M · ~1-2h AI** for diagnosis; fix scope opens after.
8. **link-target-autosearch** — [`link-target-autosearch.md`](platform/link-target-autosearch.md). **M · ~3h AI.** Picker + anchor registry + MCP tools + 8 editor swaps + module-title id emission + hashchange listener as one chunk. **Depends on F6.**
9. **AUI mode infrastructure refactor** — [`aui-mode-hierarchy.md`](admin/aui-mode-hierarchy.md). **M · ~1-2h AI.** Themes + Posts onto inheritance shape + ESLint rule + lazy-load convention. Foundational; per-pane onboardings are each their own roadmap items.

### Wave 2.5 — Admin UX track (research-driven, ship in parallel with Wave 2)

These items compound — each is independently shippable, but the operator-grade lift comes from having all of them. Schedule in any order; no inter-dependencies within the wave. Pairs naturally with Sonner (Wave 0c) — kbar action → toast.promise.

W2.5a. ~~**Admin command palette**~~ — ~~[admin-command-palette.md](admin/admin-command-palette.md)~~. **M · ~2-3h AI.** **Shipped 2026-05-14** — kbar ⌘K, auto-populated from `adminUILoaderRegistry`, shell-wide `KBarProvider` + top-bar trigger + `?` cheatsheet + `g h/p/t` chords + mobile FAB. Per-feature `useRegisterActions` (⌘S / ⌘↵ / ⌘⇧P / `/`) deferred to per-pane fast-follow. See [shipped.md](shipped.md).

W2.5b. ~~**Admin empty states + onboarding**~~ — ~~[admin-empty-states-onboarding.md](admin/admin-empty-states-onboarding.md)~~. **M · ~2-3h AI. Shipped 2026-05-14** — operator-grade `EmptyState` upgrade: 15-key inline-SVG illustration set keyed per surface (`art` prop), `onboardingCta()` deep-link helper into the first-run wizard, `AdminCrudListModule` `art`/`secondary` pass-through, wired across 16 admin empty-state surfaces. Hand-drawn Stitch illustrations remain wall-clock cost (out of AI budget — the inline-SVG set is the stand-in). First-run wizard + seeded sample bundle shipped earlier as Q7. See [shipped.md](shipped.md).

W2.5c. **Admin permissions UX** — [admin-permissions-ux.md](admin/admin-permissions-ux.md). **L · ~5-6h AI.** 4-tier UX (Full / Edit / Comment / View) + role presets + groups. Underlying grants engine already shipped.

W2.5d. ~~**Admin inline editing**~~ — ~~[admin-inline-editing.md](admin/admin-inline-editing.md)~~. **L · ~4-6h AI. Shipped 2026-05-14** — `data-edit-target` round-trip closed: click a tagged public element in admin mode → in-place quick-edit drawer for `modules`/`sections`, or deep-link to the editor pane (`?focus=`/`?editId=`) for `pages`/`posts`/`products`. As-built has no preview iframe — the build view renders the public page in-place, so the spec's `postMessage` bridge was unnecessary. Per-pane `?focus=` consumption deferred. See [shipped.md](shipped.md).

W2.5e. **Admin content releases** — [admin-content-releases.md](admin/admin-content-releases.md). **XL · ~2-3 days AI.** First-class Release entity, atomic publish, preview-at-perspective, rollback. 2025 Sanity differentiator vs Strapi / Payload.

### Wave 3 — Platform S/XS (15-60 min AI each)

10. **Mobile column behavior** — [`mobile-column-behavior.md`](platform/mobile-column-behavior.md). **S · ~1h AI.** Section-level `mobileBehavior` enum + drawer accordion mixin + admin Select. Shared `@mixin section-row-collapsible` is what Mobile-friendly admin reuses — schedule before or in parallel with Wave 1 #1.
11. **C13b Manifesto link-target** — **S · ~30 min AI.** Depends on link-target-autosearch.
12. **Bundle-import restart hook** — **XS · ~15 min AI.**
13. **F8-e2e** — **S · ~30-60 min AI.** Un-skip MCP E2E + re-enable triggers.
14. ~~**mcp-rollout aftermath quick fixes**~~ — **S · ~30 min AI combined. Shipped 2026-05-14** — batched chunk for #1 / #5 / #9 / #11 / #12. All five fixed (verified in code: `section.update` genuine upsert, dev-token `admin:bundle` scope, `page.touch` MCP tool, `normalizeSectionInput.ts` INFRA_TOPOLOGY rename, permissive `sanitizeAssetName`). Whole [mcp-rollout-aftermath.md](platform/mcp-rollout-aftermath.md) annex closed — every issue fixed or with a terminal disposition (#2 documented, #8/#10 deferred). See [shipped.md](shipped.md).
15. **Q5-del** — **XS · ~15 min AI.** Admin-segregation Phase 3 cleanup after ≥1 release with zero `legacy-route` errors.

### Wave 4 — Platform XS

16. **gqty schema regen** — **XS · ~5 min AI.**

---

### Wave 5 — Storefront foundation (design system)

This is the gate to everything storefront. Don't start Wave 6/7 until at least one first-class theme has shipped, otherwise the new public-facing surfaces ship under the simpleton presets we're trying to retire.

17. **First-class themes (first 2-3 of ≥5)** — [`first-class-themes.md`](storefront/first-class-themes.md). **XL · multi-week, parallelisable per theme.** Ship the first **two or three** themes as the foundation, then add the rest in parallel with Wave 6/7. Recommended first three by audience coverage:
    - `editorial` (portfolios, writers — closest to current `Paper`, lowest design risk)
    - `agency` (motion-forward, dark-first — exercises the animation primitives + dark-mode discipline from Wave 2 #5)
    - `commerce` (catalogue-first — directly used by Wave 7 ss.com)
    Each theme: Stitch design doc + theme.json + SCSS + header+logo + footer + animations + per-module pass + 375 px mobile + plugin/module additions where needed. Retire the unused simpleton presets only after ≥3 first-class themes have shipped + at least one site has migrated cleanly.
    **Depends on Q4-cap (Wave 0), [logo-style-options.md](content/logo-style-options.md), [mobile-column-behavior.md](platform/mobile-column-behavior.md) (Wave 3 #10).**

### Wave 5.5 — Cross-theme shared modules + customer-account modules (ship in parallel with Wave 5)

Picked from [new-modules-catalogue.md](_meta/new-modules-catalogue.md). Each module is its own jump. Ship opportunistically with the first theme / surface that needs each one.

W5.5a. **Cross-theme shared modules** — `StickyCtaBar` · `ComparisonTable` · `SchemaOrgInjector` · `OgImageGenerator` · `SaveSearchPrompt` · `BreadcrumbBar` · `EmptyStateBlock` · `CookieConsentBanner` (stub). **~15-20h AI total** distributed by demand.

W5.5b. **Customer-account modules** — `AccountDashboardGrid` · `OrderProgressTimeline` · `OrderDetailModule` · `WishlistGrid` · `SavedSearchList` · `MagicLinkRequestForm` + `MagicLinkConfirmation` · `OauthButtonStack`. **~12-15h AI total.** Bundle with Wave 6c signup.

### Wave 6 — Storefront enabler

W6a. **Receipt + transactional emails** — [storefront-receipt-emails.md](storefront/storefront-receipt-emails.md). **M · ~3h AI.** Email templates as a product surface. Land before signup so magic-link + receipt flow has its templates ready.

W6b. ~~**Faceted filter system**~~ — [storefront-faceted-filter-system.md](storefront/storefront-faceted-filter-system.md). **L · ~6-8h AI. Shipped 2026-05-14** — filter-state lib + chip/facet UI + `/products` wired as reference consumer. `/cars` URL-sync + server `$facet` aggregation + saved-search backend/worker/MCP + mobile drawer deferred to follow-ups. See [shipped.md](shipped.md).

W6c. ~~**Public signup + marketing attribution + anonymous checkout**~~ — [`client-signup-and-anonymous-checkout.md`](storefront/client-signup-and-anonymous-checkout.md). **M-L · ~5-7 days AI. Shipped 2026-05-14** — verification + gap-close pass confirmed all three spec gaps (magic-link cross-device pre-fetch mitigation, delayed-account-creation-only checkout, first/last-touch UTM attribution) already closed by prior W6c work. See [shipped.md](shipped.md). Original plan retained below for archaeology.
    - Magic-link via NextAuth `EmailProvider` (~1 day) — **the only net-new auth method**; wires to existing `EmailService`.
    - Public `/account/*` pages (~1-2 days): signup / login / verify / reset / magic-link / account / orders / order-by-token — VM4-compliant, on top of existing `CustomerAuthService` primitives.
    - Anonymous checkout polish (~half day): thread guest path through existing `/checkout` using existing `guestEmail`+`orderToken` fields; add receipt-email trigger to `OrderService` finalize.
    - Marketing attribution (~1-2 days): NET-NEW `MarketingReferrer` table + UTM/`ref` capture + admin attribution pane.
    - Email templates + theme integration (~1 day): per-theme auth/checkout/account frames in Stitch (carries into Wave 5).
    - Facebook/Apple OAuth providers + per-site OAuth secret encryption via existing `secretBox.ts` (~half day, opt-in).
    - E2E (~1 day): signup flow + anonymous-checkout flow + guest→customer upgrade by email match.
    Can start in parallel with Wave 5 once Q4-cap lands; the per-theme styling is the only piece that gates on themes being ready (do at least `commerce` theme + signup screens together).

### Wave 7 — Storefront long pole

W7a. **Cars vertical modules** — [new-modules-catalogue.md](_meta/new-modules-catalogue.md) §Cars. `CarListingCard` · `CarVehicleDetailPage` (composite) · `CarPhotoGallery` · `CarSpecTable` · `CarReservationCta` · `VatBadge` · `CarComparisonTable` · `CarFinanceEstimator` (stub). **~20-30h AI total** as one jump (modules tightly coupled to the cars surface).

W7b. **ss.com cars integration** — [`ss-com-cars-integration.md`](storefront/ss-com-cars-integration.md). **L · ~1-2 weeks AI** (collapsed from XL — Inventory adapter system already shipped, `IProduct.source/externalId/attributes` already shipped, ss.com is one new `IWarehouseAdapter`).
    - **Acquisition path (operator decision, blocking external traffic):** A (partner data licence — recommended) / B (public RSS + paginated HTML — prototype-friendly) / C (full scrape — off the table for commercial). Engineering can start on path B against fixtures while A negotiates.
    - Fetcher + normaliser + lifecycle (~3-5 days against fixtures). Idempotency follows the existing per-mutation `idempotencyKey` pattern (no generic engine), cascade lifecycle reuses the existing `cascadeRules` + `.trash` + 24h TTL machinery (`services/infra/cascadeDelete.ts`).
    - Admin pane + MCP tools (~2 days).
    - First theme's car surface (Stitch design + code — pairs with the `commerce` theme from Wave 5) (~4-5 days).
    - Buyer e2e + fixtures (~2 days).
    - Per-additional-theme car surface: ~2 days each.
    **Depends on Wave 5 first-class themes (≥`commerce`), Wave 6 (anonymous checkout + receipt emails + faceted filter system), Q4-cap (Wave 0).**

### Wave 8 — Pre-public-deploy gates

W8a. **Accessibility WCAG 2.2 AA audit** — [accessibility-wcag22-audit.md](storefront/accessibility-wcag22-audit.md). **L · ~1-2 weeks AI.** All public surfaces audited × every theme × both modes. axe-core in e2e + Pa11y batch + Lighthouse ≥95. **Legally required in EU from 2025.** Pre-public-deploy blocker.

W8b. **GDPR / consent / PII / data rights** — [storefront/gdpr-privacy-consent.md](storefront/gdpr-privacy-consent.md). **XL · ~3-4 days AI.** ~~Cookie consent banner with category opt-in, DNT/GPC honour, cookie classification~~ **(consent / cookie / DNT-GPC slice + analytics/marketing capture gating + client-visible retention summary shipped 2026-05-14 — see [shipped.md](shipped.md))**; data-export + delete-my-account APIs + `/account/settings?tab=privacy` shipped separately. **Still open:** PII redaction on ss.com upstream data, standalone themed `/privacy` + `/privacy/cookies` + `/privacy/preferences` + `/terms` pages, server-side retention TTL indexes, `privacy_*` MCP tools, operator legal-copy editor, `cookie-coverage.mjs` CI script.

W8c. **Email deliverability hardening** — [storefront/email-deliverability-hardening.md](storefront/email-deliverability-hardening.md). **L · ~6-8h AI.** SPF / DKIM / DMARC + Resend domain verification + bounce/complaint webhook → suppression list + RFC 8058 one-click unsubscribe + send-rate warmup + deliverability dashboard.

W8d. **Performance budget CI** — [platform/performance-budget-ci.md](platform/performance-budget-ci.md). **M · ~3h AI.** Lighthouse CI + Core Web Vitals gates + size-limit per-route + 10% RUM beacons. Sibling of W8a a11y audit.

W8e. **Backup + disaster recovery** — [platform/backup-and-disaster-recovery.md](platform/backup-and-disaster-recovery.md). **L · ~5-6h AI.** Restic + B2 daily/6h backups + weekly automated restore drill + 4 failure-mode runbook + admin pane. RPO ≤ 6h / RTO ≤ 1h.

W8f. **Customer notification preferences** — [storefront/customer-notification-preferences.md](storefront/customer-notification-preferences.md). **L · ~6-7h AI.** Per-category opt-in/out, in-app inbox via Presence, quiet hours, digest cadence, RFC 8058 unsubscribe integration. Pairs with W8c.

W8g. **Multi-currency + tax** — [storefront/multi-currency-and-tax.md](storefront/multi-currency-and-tax.md). **L · ~6-8h AI.** Multi-currency `IProduct.prices`, daily ECB FX, VAT regime resolver, Stripe Tax + VIES B2B validation. Closes the "no multi-currency in v1" note.

W8h. **SEO program** — [storefront/seo-program.md](storefront/seo-program.md). **L · ~6-8h AI.** robots.txt env-gating, dynamic sitemap with per-feature contributors, OG image generator, canonical + hreflang, schema.org injection, redirect map, meta pre-flight. Required for ss.com listings to be discoverable.

---

### Coordination notes

- **Stitch + design plugin is now load-bearing.** Three roadmap items (first-class themes, dark-mode audit, ss.com per-theme car surfaces) all use Stitch as the design source. Treat the design plugin as critical-path tooling — file a sub-task if the plugin gaps block code handoff.
- **Local POC scope** means GDPR / consent / PII redaction are deferred for ss.com + signup + attribution. They'll be a separate pre-deploy roadmap item later, not v1 acceptance.
- **Email deliverability** is a soft prerequisite for Wave 6 (magic-link auth lives or dies on email delivery). On local POC, MailHog or similar is fine; production-grade SPF/DKIM/DMARC is deferred to deploy time.
- **Stitch frames belong in the repo** alongside the theme they document (link in each theme's `README.md`). Same for the dark-mode audit punch list (`docs/audits/admin-dark-mode-…/`).

### Total work estimate (post-research 2026-05-12) — AI agent hours only

Per §14 standards, all sizing in **AI agent units**. Wall-clock cost (deploys, design pass, operator review) is tracked separately.

| Wave | Track | AI hours | Notable wall-clock |
|---|---|---|---|
| 0 | Foundation (Q4-cap + motion tokens + Sonner + testid CI) | ~3h | — |
| 1 | Platform L (Mobile-friendly admin) | ~6-8h | On-device QA |
| 2 | Platform M (F8-bulk / F6 / dark-mode audit / F8-stream / drag-reorder / link-target / AUI-mode) | ~12-15h | — |
| 2.5 | Admin UX (command palette / empty states / permissions / inline editing / content releases) | ~24-32h | Illustration design |
| 3 | Platform S/XS | ~3-4h | — |
| 4 | Platform XS | ~5 min | — |
| 5 | Storefront foundation (8 first-class themes) | ~110-200h | Stitch design + operator review per theme |
| 5.5 | Cross-theme + customer-account modules | ~27-35h | — |
| 6 | Storefront enabler (receipt emails + faceted filters + signup) | ~80-100h | Email-client QA |
| 7 | Cars modules + ss.com integration | ~60-80h | Acquisition-path operator decision |
| 8 | Pre-public-deploy (8 sub-items: WCAG a11y / GDPR / email-deliverability / perf-CI / backup-DR / notification-prefs / multi-currency-tax / SEO) | ~120-160h | Manual screen-reader passes + DNS propagation + B2 setup |

**MCP coverage** ([mcp-coverage-storefront-program.md](_meta/mcp-coverage-storefront-program.md)) and **module catalogue** ([new-modules-catalogue.md](_meta/new-modules-catalogue.md)) — counted in the parent waves above; no double-count.

**Platform + admin UX tracks (Waves 0-4 + 2.5):** ~50-60h AI total.
**Storefront program (Waves 5-7):** ~280-415h AI total — multi-day-AI runs even with jumps.
**Pre-public-deploy gating (Wave 8 — 8 sub-items):** ~120-160h AI.

**Total to public launch: ~450-635h AI agent work**, parallelisable across tracks. At single-agent throughput on jump-sized chunks, that's roughly **11-16 weeks** of focused agent time; operator-decision wall-clock + design wall-clock + on-device QA + DNS propagation + B2 setup adds another 4-8 weeks calendar.

### Backlog — concrete-trigger parking lot

Items deferred until a real driver appears (third-party plugin author, customer ask, recurring bug, external dependency). Not budgeted in any wave. See [`backlog.md`](backlog.md) for the full list. Currently parked: **F8-sdk** plugin SDK · **C17** sample audit · Mobile-friendly admin **native wrapper** · mcp-rollout `#8` Mongo healthcheck · per-page site-mode toggle.
