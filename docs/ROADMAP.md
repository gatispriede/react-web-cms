# Roadmap — redis-node-js-cloud CMS

Forward-looking only. Architecture: [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) + the UML at [architecture/data-model.svg](architecture/data-model.svg). Per-item plans + estimates: [`roadmap/`](roadmap/). Shipped archive: [`roadmap/shipped.md`](roadmap/shipped.md).

---

## Status (2026-05-17)

- **`origin/develop` HEAD:** `cdd7f5d` — all threads merged. 100+ commits since last status covering: App Router migration complete (B2–B7 + cutover), 8 first-class themes shipped (editorial / commerce / agency / saas-landing / restaurant / portfolio / local-business + structural variants), admin-information-architecture (5-bucket task-driven taxonomy: Build / Content / Settings / Analytics / System), EU-compliant invoicing + credit notes + PDF + CSV, admin content releases (Release entity + atomic publish), dropship TME adapter scaffold, OnboardingChecklistService (active first-time guide), Stitch design pipeline + 2 POC modules (KeyValueDossier, SectionHeading), useAutoPageview migrated to App Router.
- **Known regression:** nav rail swaps when clicking cross-area links (e.g. Content → Publishing shows the legacy `release` rail instead of staying in `content`; Settings → Theme shows legacy `client-config` rail). Root cause: items in the new 5-bucket rails still point at legacy URLs (`/admin/release/publishing`, `/admin/client-config/themes`), and `isInArea()` resolves area by URL prefix. Fix: either move those pages to their new bucket URLs or add an override map in `isInArea()` for cross-area links.
- **Pending caveats:** `OgImageGenerator` cross-theme primitive (needs `@vercel/og` install, operator decision); visual baselines need operator capture run (`playwright test --update-snapshots`).
- **Operator post-merge ops queued:** email DNS (SPF/DKIM/DMARC), B2+restic, Stripe test keys, legal `/privacy`+`/terms`, screen-reader passes, visual baseline capture.

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

- **Admin-IA nav rail regression (bug)** — cross-area links in the 5-bucket rails (Content → Publishing at `/admin/release/publishing`, Settings → Theme at `/admin/client-config/themes`) cause the subnav to swap to the legacy area's rail instead of staying in the parent bucket. `isInArea()` in `adminAreaItems.ts` resolves area by URL prefix. Fix: move remaining pages to their new bucket URLs or add a parent-bucket override map. **S** (~1h).
- [Module-compose every customer page](roadmap/platform/all-pages-module-composed.md) — filed 2026-05-13 from operator feedback during first-class-themes pass: every customer-facing URL (account/* / blog / welcome / cars / etc.) should render via a system-page registration + module dispatch — no bespoke JSX. Where a module doesn't exist for the surface, ship one. Phase 1.C + 1.D already module-composed products + checkout + account dashboard + magic-link; this jump covers the remaining 14 hand-coded customer pages and ~8 net-new modules (OrdersList, AddressList, PaymentMethodList, NotificationInbox, SignupForm, SigninForm, BlogPost, CarsList). **XL** (multi-week, parallelisable per page). Closes the "themes only affect module-composed pages, so all pages must be module-composed" gap.
- ~~[Module-compose every admin pane](roadmap/admin/admin-module-composed.md)~~ — ✅ shipped (commits `da3dc60`→`aaf1c3a`). All ~40 admin panes module-composed via 7 `EAdminModuleType` shapes (info surface, CRUD list, single-doc form, action panel, wizard, preview, conflict). `/admin/build` remains the only exempt surface.
- **Radical per-module theme variants** — companion to first-class themes. Filed 2026-05-13 by operator feedback: "main part of themes is that they don't just change color and font; it should be more radical per module — alignment, placement, arrangement, animations, even functionality. example: Gallery — default = list of image + text, another theme = layered, another = banner". Same DOM contract; fundamentally different layout / arrangement / animation per theme. **First pass shipped 2026-05-14** — Gallery / Hero / Timeline now carry structural variants across all 5 first-class themes (`services/themes/<slug>/module-styles.scss`, scoped `[data-theme-name="<slug>"]`, pure CSS, no DOM change): Gallery = broken-grid / banner-band / tight-grid / depth-stack / vertical-list; Hero = photo-bleed-left / centred-overlay / split / split-glow / photo-bleed-centre; Timeline = broken-grid / horizontal-track / compact-vertical / horizontal-track / centred-spine. **Second pass shipped 2026-05-17** — ProjectGrid + OrderProgressTimeline + Footer now carry structural variants across all 7 themes (still pure CSS, same DOM): ProjectGrid = offset-magazine (agency) / broken-grid (portfolio) / typographic-ledger (editorial) / tight-uniform (commerce) / elevated-cards (saas-landing) / menu-list (restaurant) / poster-stack (local-business); OrderProgressTimeline = horizontal-minimal (agency) / vertical-thick-spine (portfolio) / vertical-ruled-ledger (editorial) / horizontal-pill-track (commerce) / elevated-stepped (saas-landing) / vertical-warm (restaurant) / horizontal-compact-ledger (local-business); Footer = brand-led-XXL (agency) / minimal-2-col (portfolio) / masthead-vertical-rules (editorial) / dense-catalogue (commerce) / light-grid-feature-col (saas-landing) / centered-location-led (restaurant) / address-card-led (local-business). All catalogue modules now carry per-theme structural variants. **L** (first pass done; remainder ~S-M).
- ~~[F6 — site-mode toggle: scroll vs multipage](roadmap/platform/site-mode-toggle.md)~~ — ✅ shipped (commit `32ec743`).
- ~~[Admin dark-mode audit](roadmap/admin/admin-dark-mode-audit.md)~~ — ✅ shipped (commit `1c98911`).
- ~~**Mobile column behavior**~~ — ✅ already shipped (commit `1b7051d`). Section-level `layout.mobileBehavior` enum (`stack` | `collapse` | `keep-ratio`) — see [roadmap/platform/mobile-column-behavior.md](roadmap/platform/mobile-column-behavior.md). Implementation lives in `ui/client/lib/SectionContent.tsx` (runtime), `ui/admin/features/Dialogs/AddNewSectionItem.tsx` (admin Select), and `services/features/Mcp/tools/pages.ts` (`page.section.upsert` schema). Originally listed as "needs spec doc" — the spec doc exists and is current.
- **Visual baseline capture** — fixture-setup diagnosis ✅ closed 2026-05-13. Each spec died in `MongoMemoryServer.create()` because the library auto-resolved to the absolute-latest MongoDB tarball (8.2.1 on ubuntu2404) which the CDN hasn't published, returning 403 → "Status Code is 403 (MongoDB's 404)" → ~3ms instant fail per spec. Pinned `config.mongodbMemoryServer.version` to `7.0.14` (LTS, widest platform-binary coverage incl. ubuntu2404) in `package.json`. **Remaining = operator capture run**: free port 80, then `npx playwright test --project=visual --update-snapshots` and commit `tests/e2e/visual/__snapshots__/`. ~30 min wall-clock.
- **F8 MCP follow-ups** — streaming transport for bundle/image ops (✅ partly shipped 6c091be), plugin SDK for third-party tools, E2E un-skip post Windows-fanout fix. See [roadmap/platform/mcp-real-world-ready.md](roadmap/platform/mcp-real-world-ready.md).
- **1 lingering `test.skip`** — idempotency reusable-button e2e: needs a non-destructive guarded button candidate to assert "in-flight call settles → button re-enables" without firing a destructive mutation. (Trash restore-flow ✅ un-skipped 2026-05-13 by adding stable testids to the AntD Popconfirm OK/Cancel buttons + the trigger.)

### Forward work — admin UX (Wave 2.5)

- ~~[admin-command-palette.md](roadmap/admin/admin-command-palette.md)~~ — ✅ shipped (commit `d287ac4`).
- ~~[admin-empty-states-onboarding.md](roadmap/admin/admin-empty-states-onboarding.md)~~ — ✅ shipped (commit `9fd1548`).
- ~~[admin-permissions-ux.md](roadmap/admin/admin-permissions-ux.md)~~ — ✅ shipped (commit `8a3b978`).
- ~~[admin-inline-editing.md](roadmap/admin/admin-inline-editing.md)~~ — ✅ shipped (commit `8a3b978`).
- ~~[admin-content-releases.md](roadmap/admin/admin-content-releases.md)~~ — ✅ shipped (commit `96b2b06`).

### Forward work — storefront enablers (Wave 6)

- ~~[storefront-receipt-emails.md](roadmap/storefront/storefront-receipt-emails.md)~~ — ✅ shipped (commit `f9d582a`).
- ~~[storefront-faceted-filter-system.md](roadmap/storefront/storefront-faceted-filter-system.md)~~ — ✅ shipped (commit `9320684`).
- ~~[client-signup-and-anonymous-checkout.md](roadmap/storefront/client-signup-and-anonymous-checkout.md)~~ — ✅ shipped (commit `e1a4538`).

### Forward work — storefront stretch (blocked on operator decisions)

- **PC-parts dropship vertical** — pivoted from ss.com cars to PC-parts dropshipping via TME (commit `6d98404`). `IDropshipDistributorAdapter` interface shipped + TME adapter scaffold with real-call wiring behind `isConfigured` guard. Cars-vertical modules remain in tree but are secondary.
- ~~[First-class themes — Stitch-designed, full coverage](roadmap/storefront/first-class-themes.md)~~ — ✅ **8 themes shipped** (editorial / commerce / agency / saas-landing / restaurant / portfolio / local-business + Paper v5). Per-module structural variants for Gallery / Hero / Timeline across all themes. Per-theme visual pass across module catalogue. ProjectGrid / OrderProgressTimeline / Footer still token-reskin only — next pass.
- **OgImageGenerator** cross-theme primitive — uses `@vercel/og` or equivalent. **Operator install decision pending** (~$0 cost, but adds 1 dep + 1 API route).

### Forward work — pre-public-deploy gates (Wave 8 — ~120-160h AI)

EAA-mandated + operational hygiene before any public-internet deploy:

- [accessibility-wcag22-audit.md](roadmap/storefront/accessibility-wcag22-audit.md) — WCAG 2.2 AA across new storefront surfaces (modules ship 44px tap targets + theme-tokenised contrast; audit closes the gap).
- ~~[gdpr-privacy-consent.md](roadmap/storefront/gdpr-privacy-consent.md)~~ — ✅ W8b slice shipped (commit `f91a8ae`). `CookieConsentBanner` live.
- [email-deliverability-hardening.md](roadmap/storefront/email-deliverability-hardening.md) — SPF/DKIM/DMARC, suppression list, warmup. **Operator action required for DNS records.**
- [performance-budget-ci.md](roadmap/platform/performance-budget-ci.md) — Lighthouse + Core Web Vitals + size-limit in CI.
- [backup-and-disaster-recovery.md](roadmap/platform/backup-and-disaster-recovery.md) — Restic + B2 + drill, RPO 6h / RTO 1h. **Operator action: B2 bucket + restic init + passphrase.**
- [customer-notification-preferences.md](roadmap/storefront/customer-notification-preferences.md) — preference center + in-app inbox.
- ~~[multi-currency-and-tax.md](roadmap/storefront/multi-currency-and-tax.md)~~ — ✅ shipped (commit `edea545`).
- [seo-program.md](roadmap/storefront/seo-program.md) — sitemap + OG + schema.org + redirects (the new `SchemaOrgInjector` primitive seeds this).

### Forward work — infra / deploy fragility

- **Deploy auto-rollback on health-check fail** — tag `app:current` before rebuild + restore on health-check failure, or promote `SEAMLESS_DEPLOY=1` to default. **S**.
- **Image registry (GHCR)** — biggest single deploy-fragility win. Cold start 6-8 min → ~30 sec. **M** (~half day), $0-3/mo.
- **Declarative `.env` (split static vs runtime)** — pairs with image-registry. **S**.
- ~~**Terraform droplet + DNS + firewall**~~ — cancelled (commit `4e96515`). Imperative SSH bootstrap is good enough for POC scale.
- ~~**Bundle-import → `markRestartRequired()` hook**~~ — ✅ shipped 2026-05-13. `detectLocaleDrift()` in `BundleService.ts` compares the imported bundle's language symbol set to the runtime `next-i18next.config.js` locale list; any drift surfaces as a `source: 'i18n'` restart-required reason (idempotent via `key: 'bundle-locale-drift'`). 7 unit tests cover drift / no-drift / dedupe / empty-symbol / whitespace / live-config paths. Avoids the locale-stale errors seen on skyclimber import.

---

## What landed recently

See [`roadmap/shipped.md`](roadmap/shipped.md) for the full archive. Highlights since 2026-05-14:

- **App Router migration complete** (B2–B7 + cutover) — mongo re-entry guard, revalidate dual-mode, public shell, dynamic routes (`[...slug]` + blog), commerce/account routes, auth + admin routes, cleanup + cutover. Pages Router tree removed. `useAutoPageview` migrated to `usePathname`/`useSearchParams`.
- **8 first-class themes shipped** — editorial, commerce, agency, saas-landing, restaurant, portfolio, local-business + Paper (v5). Each carries per-theme baseline specs. Radical per-module structural variants for Gallery / Hero / Timeline across all themes.
- **Admin information architecture** — 5-bucket task-driven taxonomy (Build / Content / Settings / Analytics / System). Shared `<PaneHeader>` lifted into `AdminCrudListModule` + `AdminFormModule` (propagates to 16 CRUD + 9 form panes). Plain-English labels + tooltips for non-technical operators. 301 redirect shim for legacy URLs. **Known regression:** cross-area nav rail swap (see Status).
- **EU-compliant invoicing** — `InvoiceService` + `InvoiceSequence` (atomic per-year numbering), credit notes with void + refund flow, `@react-pdf/renderer` A4 PDF, RFC-4180 CSV export, 6 MCP tools, admin pane with COGS toggle.
- **Admin content releases** — Release entity + atomic publish (`release.create` / `release.publish` / `release.rollback`).
- **Dropship TME adapter** — `IDropshipDistributorAdapter` interface + TME real-call wiring behind `isConfigured` guard. Pivoted first-impl from TD SYNNEX to TME.
- **OnboardingChecklistService** — active first-time guide. Cross-cutting checklist (site title, contact email, DKIM, payment provider, backups, etc.) with per-operator dismissals + guided-tour step tracking.
- **Stitch design pipeline** — 6-step process codified + 2 POC modules shipped (KeyValueDossier, SectionHeading). Module screenshot MCP tools (`module.screenshot.list` / `module.screenshot.get`).
- **Admin module-compose** — all ~40 admin panes module-composed via 7 `EAdminModuleType` shapes. Admin dark mode wired. kbar command palette shipped. Sonner toast system. Empty states + onboarding. Permissions UX + inline editing.
- **Storefront** — faceted filter system (chips + URL state + saved search), Amazon-style cart + checkout chrome, richer product detail + search/sort/category subpages, category-keyed product placeholders + Redis fallback.
- **Infra** — TS error burn-down 107→0, logo style options (multi-variant assets), admin auth split fixes (session cookie path, sign-out, sign-in button), bundle-import body cap, SCSS hoist sweep (50 more module imports).

---

## Cancelled

Items removed from the open queue with the rationale recorded so a future maintainer doesn't reopen them.

- **Section + module drag-reorder root cause** (cancelled 2026-05-13). The explicit up/down + label arrow buttons shipped in 2026-05-04 commits `cc306a7` + `576b212` + `a12c7b6` are the permanent UX — flat arrow controls are clearer, keyboard-accessible, and predictable on mobile. The underlying `getChangedPos` + `DraggableWrapper` drag flow is no longer the operator-facing affordance; diagnosing it would cost an M with no user-visible payoff. F3 v1-url-namespace (cancelled earlier) sets the precedent for this kind of strategic close.
