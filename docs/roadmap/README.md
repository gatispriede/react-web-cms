# Roadmap plans

One markdown per active roadmap item. Each file has the same shape:

- **Goal** — what shipping this means
- **Design** — approach, decisions, data model touches
- **Files to touch** — approximate surface
- **Acceptance** — how we know it's done
- **Effort** — rough time budget (see legend)

Shipped items live in [`shipped.md`](shipped.md) — kept for archaeology, not active triage. Backlog ideas deferred until a real driver appears live in [`backlog.md`](backlog.md).

## Directory layout

| Subdir | What lives there |
|---|---|
| [`_meta/`](_meta/) | References + standards + catalogues (not roadmap items themselves) |
| [`storefront/`](storefront/) | Public-facing program: themes, commerce, accessibility, privacy, email deliverability |
| [`admin/`](admin/) | Operator-grade admin polish (current track: themes-driven content release flow) |
| [`platform/`](platform/) | Infra / MCP / migrations / tooling |
| [`content/`](content/) | Content module + media pipeline polish |
| [`archive/`](archive/) | Historical items kept for archaeology |

## Universal requirements — every roadmap item

These are acceptance criteria, not nice-to-haves.

1. **Docs reflect the work.** When an item ships, update the relevant spec doc (mark it shipped or amend), `docs/roadmap/shipped.md`, and any architecture / runbook docs that diverge. Inline code comments cover the *why*; markdown docs cover the *where to look first*.
2. **MCP coverage parity for editable surfaces.** Every feature whose content / state / config can be authored through the admin UI must also be manageable via MCP — same operations, same guards. MCP is the canonical write path for AI authoring; admin UI is the human surface on top. New editable field → MCP tool (or extension to an existing tool's schema) lands in the same PR. **All content management — including products, warehouse inventory, leaf product pages, category pages, system pages, and per-tenant configuration — falls under this requirement.**
3. **Ship as jumps, not phases.** Each roadmap item is one complete deliverable. No "Phase 1 / Phase 2 / Phase 3" inside an item. If a feature is genuinely too large for one chunk, split into separately-named roadmap items, each with its own acceptance criteria. WIP working tree may go red mid-jump; tests + e2e at PR-open is the gate. AI estimates only — no man-days mixed in.
4. **`data-testid` on every interactive surface.** Any new or modified UI component lands with `data-testid` attributes on every element an e2e test could plausibly target. CI hard-gates: `tools/scripts/testid-coverage.mjs` (shipped 2026-05-14) fails on missing attrs in changed `.tsx` files.

## Effort legend — AI-paced

| Size | AI budget | Pre-AI human equivalent |
|------|-----------|------------------------|
| XS   | < 15 min  | < 1 h |
| S    | 15-60 min | 1-3 h |
| M    | 1-3 hours | 0.5-1 day |
| L    | 3-8 hours | 1-3 days |
| XL   | 1-3 days  | 1+ weeks |

## Active queue

### Storefront — commerce + design

| Item | Track | Size | Notes |
|------|-------|------|-------|
| [first-class-themes.md](storefront/first-class-themes.md) | 5 | XL (multi-week) | 5 of 8 themes still need design pass — `local-business`, `saas-landing`, `portfolio`, `agency`, `commerce`. `editorial` / `restaurant` / `event` shipped. Each remaining theme needs Stitch frames + per-module SCSS pass. |
| [pc-parts-dropshipping-integration.md](storefront/pc-parts-dropshipping-integration.md) | 7 | XL (~5-7 days AI) | NEW — replaces deleted ss-com-cars spec. `IDropshipDistributorAdapter` extending W7b's warehouse adapter shape + `placeOrder` / `getOrderStatus` / `getReturnPolicy` / `quoteWholesale`. First impl against TD SYNNEX StreamOne (pan-EU + UK). Operator holds no inventory — every checkout forwards to distributor. Wires into existing Phase 1.B/1.C/1.D + W6a/W8g. **Operator post-merge: partner account onboarding (1-2 weeks).** |
| [logo-style-options.md](content/logo-style-options.md) | content | S-M | Multi-variant logo (full / icon / mono) per theme; needed by first-class-themes' 5 remaining themes. |

### Pre-public-deploy gates

| Item | Track | Size | Notes |
|------|-------|------|-------|
| [accessibility-wcag22-audit.md](storefront/accessibility-wcag22-audit.md) | 8a | L (~1-2 weeks wall-clock) | Automated parts shipped (axe-core dev panel, Pa11y batch, Lighthouse a11y gate ≥95). **Operator manual screen-reader passes still needed** — NVDA + VoiceOver + JAWS × every theme × both modes. Pre-public-deploy blocker. |
| [gdpr-privacy-consent.md](storefront/gdpr-privacy-consent.md) | 8b | M (remaining slice) | Consent banner + DNT/GPC + data-export + delete-account cascade shipped. **Remaining: operator legal review on `/privacy` + `/terms` placeholders, server-side Mongo TTL indexes from `DATA_RETENTION_RULES`, themed `/privacy/cookies` + `/privacy/preferences` operator-editable pages, cookie-coverage CI script.** |
| [email-deliverability-hardening.md](storefront/email-deliverability-hardening.md) | 8c | S (operator-action only) | Code shipped. **Operator: DNS records (SPF / DKIM / DMARC) + Resend domain verification.** Runbook at `docs/runbooks/email-deliverability-setup.md`. |
| [backup-and-disaster-recovery.md](platform/backup-and-disaster-recovery.md) | 8e | S (operator-action only) | Restic + B2 code shipped. **Operator: B2 bucket creation + append-only application key + restic passphrase + first `restic init` + GitHub Actions drill workflow.** Runbook at `docs/runbooks/backup-and-restore.md`. |

### Platform — migrations + follow-ups

| Item | Track | Size | Notes |
|------|-------|------|-------|
| [app-router-migration.md](platform/app-router-migration.md) | 2 | XL (multi-batch) | Batch 1 of N shipped (App Router foundation + privacy/terms leaf pages). **Remaining batches:** B2 mongo re-entry guard + revalidate fix · B3 public shell + index + robots · B4 dynamic public routes · B5 commerce + account routes · B6 auth + admin pages · B7 cleanup + cutover. |
| [mcp-real-world-ready.md](platform/mcp-real-world-ready.md) | 2 | S | F8-stream shipped. MCP e2e suite (`tests/e2e/mcp/full-site-lifecycle.spec.ts`) un-skipped on CI (Linux) per F8-e2e wave; Windows local dev still skipped pending an `adminStorageState` fixture timeout fix (~30s sign-in stall — same root cause as `tests/e2e/admin/mobile-shell.spec.ts`). **Remaining: investigate + fix the Windows fixture stall so local dev parity matches CI.** |
| [terraform-kamal-migration.md](platform/terraform-kamal-migration.md) | — | M (operator-coordinated) | Funisimo cutover shipped 2026-05-08. **Remaining: Skyclimber droplet cutover.** |

### Content + media

| Item | Track | Size | Notes |
|------|-------|------|-------|
| [logo-style-options.md](content/logo-style-options.md) | content | S-M | Listed above; gates first-class-themes' remaining 5 themes. |

> Triage 2026-05-16: `carousel-preview-layout-fix`, `image-width-height-respect`, `module-transparency-style` all shipped 2026-04-24 (banners on their spec docs + `shipped.md` entries + code verified). Removed from the active queue here; archaeology stays in `shipped.md`.

### Admin — content-publish workflow

| Item | Track | Size | Notes |
|------|-------|------|-------|
| [admin-content-releases.md](admin/admin-content-releases.md) | 2.5e | XL (~2-3 days AI) | First-class `Release` entity — group N drafts → preview at perspective → publish atomically → rollback. Differentiator vs Strapi / Payload. **Note:** Phase 1.D shipped `IPage.source = 'system-page'` discriminator which this can build on. |

### Track-level READMEs

- [storefront/](storefront/README.md)
- [admin/](admin/README.md)
- [platform/](platform/README.md)
- [content/](content/README.md)

## Operator post-merge ops (no code work — your decisions / credentials / wall-clock)

These all gate the pre-public deploy. The code is shipped — operator action unblocks each one.

| Op | Item it gates |
|----|---------------|
| Stripe test → live API keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_TAX_ENABLED`) | Checkout + multi-currency + Stripe Tax |
| TD SYNNEX (or Ingram / Asbis) partner account + OAuth client | pc-parts-dropshipping-integration |
| DNS records (SPF + DKIM + DMARC) + Resend domain verification | email-deliverability-hardening |
| B2 bucket + append-only application key + restic passphrase + first `restic init` | backup-and-disaster-recovery |
| Legal review on `/privacy` + `/terms` placeholders | gdpr-privacy-consent |
| Per-theme Stitch design pass × 5 remaining themes | first-class-themes |
| Manual screen-reader passes (NVDA + VoiceOver + JAWS) | accessibility-wcag22-audit |
| Skyclimber droplet cutover scheduling | terraform-kamal-migration |
| Run `npm run features:codegen` once at merge | Generated registry stays in sync |

## Reference docs

- [`_meta/stitch-design-pipeline.md`](_meta/stitch-design-pipeline.md) — when to reach for Stitch, what to expect back, how to turn its output into a typed module
- [`_meta/target-architecture.md`](_meta/target-architecture.md) — naming conventions + top-level layout
- [`_meta/project-standards-additions-2026-05-12.md`](_meta/project-standards-additions-2026-05-12.md) — 14 standards (Sonner / kbar / dnd-kit / motion tokens / cssVar / WCAG 2.2 AA / 44 px touch / container queries / EmailService.sendTemplated / data-edit-target / jumps-not-iterations / AI-agent-unit estimates)
- [`_meta/agent-handoff-format.md`](_meta/agent-handoff-format.md) — template + starter-code patterns
- [`_meta/new-modules-catalogue.md`](_meta/new-modules-catalogue.md) — module catalogue (mostly shipped; reference for what each module is for)
- [`_meta/mcp-coverage-storefront-program.md`](_meta/mcp-coverage-storefront-program.md) — MCP tool catalogue
- [shipped.md](shipped.md) — archive of completed items
- [backlog.md](backlog.md) — parking lot for ideas deferred until a real driver appears

## Total work estimate

| Track | AI hours remaining | Wall-clock dependencies |
|---|---|---|
| Storefront (5 themes + dropship + privacy/email/backup operator ops + content polish) | ~80-130h AI | Stitch design × 5, partner account onboarding, DNS, B2 setup, legal review |
| Platform (App Router batches 2-7 + MCP e2e + Skyclimber) | ~30-50h AI | Skyclimber cutover scheduling |
| Admin (content releases) | ~15-25h AI | — |
| Pre-public-deploy gates (operator action) | 0h AI | Multi-week operator wall-clock |

**Total to public launch: ~130-200h AI** + 4-8 weeks calendar for operator wall-clock dependencies.

## Recent shipped (2026-05-13 → 2026-05-16)

See [shipped.md](shipped.md) for full archive. Highlights:

- **2026-05-16 — RSC boundary cleanup.** App-router B1 leftovers fixed: `refreshBus.ts` split (class server-safe + `useRefreshView.ts` `"use client"`), `Logo.tsx` + `ImageUpload.tsx` marked client, `app/i18n.ts` split into pure-data `i18nConfig.ts` + server-only `i18n.ts`. Unblocks `/admin` + error/404 render paths for Batch 2.
- **2026-05-16 — Storefront UX polish.** Amazon-style cart + checkout chrome (yellow CTA pill, sticky red Order Summary, secure-checkout header); richer product detail (brand row, spec table, About card); storefront search + sort + category subpages; `/account/signin` AntD restyle; bundle-import 200 MB body cap.
- **2026-05-15 → 2026-05-16 — Develop ↔ test-lEADs merge.** 59-commit parallel branch reconciled; 17 code + 81 snapshot conflicts resolved; cutover preview `master-temp` branch.
- Commerce + auth track (Phase 0 shared abstractions + Phase 1.A–F + 6 deferred sub-jumps): auth-split, Product module, products-as-composable-page, checkout-as-composable-page, client-account-settings, product-display-templates, checkout customization, abandoned cart, port wiring + auto-301, dispatch + bespoke editors, inline tabs, template polish.
- Q4-cap visual baselines: 11 surfaces + 60+ module snapshots.
- TS error burn-down: 107 → 0 across services + ui/client.
- CMS thread parallel ship: editorial + restaurant + event themes, faceted filter system, kbar command palette, admin dark mode, 9 transactional email templates, Sonner, empty states + onboarding, inline editing + permissions UX + gallery improvements, image optimisation on upload, 20+ admin pane module-compose refactors, cars-vertical modules (now obsolete + slated for cleanup with pc-parts-dropshipping-integration).
