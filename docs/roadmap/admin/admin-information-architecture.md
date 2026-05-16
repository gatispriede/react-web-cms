---
name: admin-information-architecture
description: Re-organise the admin UI. Today's panes accumulated organically — settings are scattered across `/admin/system/*`, `/admin/build/*`, `/admin/content/*`, top-level routes, drawers, and modal dialogs, with no consistent grouping principle. Operator needs to memorise where things live. This jump audits the entire admin surface, proposes a coherent information architecture grouped by operator-mental-model, then re-points every navigation entry + breadcrumb + URL to the new taxonomy. Also a coordinated visual pass — spacing rhythm, density, empty states, pane-header consistency. UI/UX polish, not a re-skin.
---

# Admin information architecture overhaul

> **SHIPPED 2026-05-16 (hybrid scope).** The new 6-bucket taxonomy is
> live — top bar, area rails, AdminView union, and 32 legacy URLs all
> 301 to new homes. Shared `<PaneHeader>` / `<EmptyState>` / `<SaveBar>`
> components land at `ui/admin/shell/*` with the 4 rhythm tokens at
> `ui/admin/styles/admin-rhythm.scss`. Six demonstrator panes (one per
> bucket: Footer / SystemPages / Invoices / Users / Analytics /
> Diagnostics) adopt the new chrome as reference examples.
>
> **Hybrid scope decision** (2026-05-16): the full ~46-pane chrome swap
> + per-loader URL move would have meant 200+ Edit-tool calls in a
> single commit on top of a taxonomy decision; landing risk too high
> for one drop. Per Option C in the implementing-agent thread, this
> jump ships the headline value (operator can find things — taxonomy +
> URL map + redirect shim + kbar + audit doc + reference chrome) and
> defers the remaining per-area sweeps. See "Follow-up: per-area
> sweep" below.

## Goal

The admin UI accumulated panes one feature-jump at a time. Today an
operator who wants to change the site's SEO defaults has to know
whether that lives under `/admin/system/seo`, `/admin/build/seo`,
`/admin/content/seo`, or as a sub-tab somewhere. The same goes for
"where do feature flags live", "where does the user list live", "how
do I edit the footer", "where are my translations". The pain is real
and a recurring source of operator friction.

This jump:

1. **Audits every admin pane**, drawer, and modal that hosts a
   settings-shaped surface. Captures URL + parent + access scope +
   what-it-does in one place.
2. **Proposes a coherent taxonomy** grouped by operator-mental-model
   (e.g. *Site* / *Content* / *Commerce* / *People* / *Analytics* /
   *System*), with one canonical home per surface and a deprecation
   shim that 301s old URLs to the new ones for a release.
3. **Re-points navigation, breadcrumbs, and routing** to the new
   taxonomy. Existing inline links (admin docs, runbooks) get
   updated in the same commit.
4. **Coordinated visual pass** — every pane header uses the same
   shape (`<PaneHeader title slot actions>`); same spacing rhythm;
   same density; consistent empty states; standard "save row"
   pattern at the bottom of forms. Not a re-skin — the admin dark
   mode + kbar palette + Sonner already shipped. This is the rhythm /
   consistency pass on top of those.

Not in scope: re-implementing any pane's content. Each pane stays
functionally identical — just at a new URL with a polished frame.

## Why now

- **Compounding cost of confusion.** Every new admin pane adds a
  decision point ("where do I put this?") that gets made
  inconsistently. The cost is paid on every operator session + every
  new contributor onboarding + every "where do I configure X"
  support exchange.
- **Pre-public-deploy proximity.** The four pre-public-deploy gates
  (a11y / GDPR / email / backup) all involve operator-side
  configuration. If the operator can't find where they are, they
  can't ship them. This jump unblocks the operator-action phase by
  making the admin findable.
- **Foundation for command-palette adoption.** Admin-command-palette
  (kbar) shipped earlier. Right now its action map is incomplete
  because the panes themselves don't have stable URLs / IDs. Locking
  the IA also locks the palette's action set.
- **First impression for prospects.** When a prospect installs the
  CMS and pokes at the admin, the current scattering reads as "this
  was built feature-by-feature with no plan." That's structurally
  fixable; it just needs the audit + re-organize.

## Scope

**In scope:**

- Full inventory of admin panes / dialogs / drawers with settings-shaped surfaces
- Proposed taxonomy + URL map (old → new) — single source-of-truth markdown table
- `AdminPageRegistry` + `AdminNavConfig` rewired to the new taxonomy
- Breadcrumbs match the new tree
- 301 redirect shim from old URLs to new (one release cycle, then dropped)
- One `<PaneHeader>` shared component everything uses — title, optional eyebrow, actions slot
- Standard `<EmptyState>` component for empty-list panes (lots of duplication here today)
- Standard `<SaveBar>` component at the bottom of every settings form (today some forms have inline save, some have a footer, some have nothing)
- Spacing rhythm — single set of vertical-rhythm tokens enforced across pane content
- Search / kbar coverage — every pane has a stable `kbar-action-<id>` testid + entry in the palette's action map
- Admin docs (`docs/info/*`, runbooks) updated for any URL changes

**Out of scope:**

- Re-implementing pane content (e.g. rewriting the Themes pane's behaviour) — that's a separate jump per pane if needed
- Re-skinning admin (dark mode, motion tokens, kbar — all shipped earlier)
- Adding new admin features beyond consolidation — feature additions belong in their own roadmap items
- Mobile-friendly admin (separate roadmap item — `mobile-friendly-admin.md` — coordinates with this jump but ships independently)
- Per-tenant customisation of admin nav — operator-mental-model first; tenant-customisation is a v2 conversation

## Design

### Audit

Phase 1 of the jump is a markdown table at
`docs/roadmap/_meta/admin-pane-inventory.md` (committed in the same
commit as the rest of the jump). Each row:

| Old URL | Pane name | Hosts (settings / list / wizard / dialog) | Access scope | Operator mental model bucket |
|---|---|---|---|---|

The inventory drives Phase 2 — the proposed taxonomy.

### Proposed taxonomy (subject to audit refinement)

**Refined 2026-05-16 — task-driven, not noun-driven.** First-shipped
taxonomy was 6 noun buckets (Site / Content / Commerce / People /
Analytics / System). Refined after operator feedback: organise by
*what am I doing in this area* rather than *what kind of thing is
this*. New top-level is 5 buckets:

| Section | Prefix | What you do here | Contains |
|---|---|---|---|
| **Build** | `/admin/build/*` | Compose the site's page tree from modules (one central page editor) | AdminApp page editor |
| **Content** | `/admin/content/*` | Author the content the site shows | Pages list, Posts, Products, Inventory, Orders, Invoices, Customers, Inquiries, Translations (entries), Cars, Releases, Trash, System pages |
| **Settings** | `/admin/settings/*` | Configure how everything works (hierarchical sub-pages) | Site chrome (Header + Logo + Footer co-located), Theme + Layout, Languages, SEO defaults, **Features** (one page per feature = enable + config), Access (Admin users + Permissions), Account |
| **Analytics** | `/admin/analytics/*` | See what happened | Overview, SEO health, Attribution, Conversion funnels, Audit log, Filters |
| **System** | `/admin/system/*` | Power-user / dev tools | MCP tokens, Feature flag definitions (registry view), Diagnostics, Errors, Performance, Backups, Bundle import/export, Modules preview, Agent, Demo content (cars seed) |

Plus a small **My account** drawer for the operator's own profile +
sign-out (accessed via the user-status badge, not a top-bar bucket).

#### Settings sub-structure (hierarchical, not flat)

The biggest win of the refinement: Settings absorbs every configuration
surface and groups them so that **things you configure together live
together**. Two unifying principles:

1. **Site chrome co-located.** Header + Logo + Footer share a single
   sub-area (`/admin/settings/chrome/*`). Operators editing one
   usually edit the others — splitting them across the admin makes
   no sense.

2. **Feature enable = feature config.** Today's split between the
   Features registry (toggles) and per-feature configuration panes
   is gone. Each feature gets ONE page that has both: the
   enable toggle at the top + every setting that feature exposes
   below it. The Features registry view (a full audit of all flags)
   stays under System for power users.

```
/admin/settings/
├── chrome/           ← Header + Logo + Footer co-located (one page or sub-tabs)
├── theme/            ← Themes + Layout + appearance tokens
├── languages/        ← language list + default + per-language toggles
├── seo/              ← site-wide SEO defaults
├── features/         ← one sub-page per feature, each = enable + config
│   ├── auth/         ← enable + providers + magic-link + OAuth + signup flags
│   ├── commerce/     ← enable + currencies + checkout + abandoned-cart + product surface
│   ├── dropship/     ← enable + adapter pick (TME / TD SYNNEX) + credentials + markup
│   ├── email/        ← enable + transport (Resend / SMTP) + templates + DKIM/SPF status
│   ├── compliance/   ← GDPR consent banner + cookie classification + DNT
│   └── redirects/    ← enable + redirect rules list
├── access/           ← Admin users + Permissions + Auth (admin-side login config)
└── account/          ← operator's own profile (alt access via user-status badge)
```

This consolidates ~18 disparate settings panes today into ~11
sub-pages, each task-scoped.

#### Bucket-assignment confirmations

- **Admin users → Settings/access** (not System) — admin access is a
  configuration concern, not a power-user tool.
- **Customers → Content** (not Settings) — they're a list operators
  view + filter + act on, not a config surface.
- **Inquiries → Content** — same reasoning as Customers.
- **People bucket dissolves** — its members fan out per the principles above.

The split between Settings and System is the most important call:
**Settings** is what an operator running the live site configures;
**System** is what a developer / technical operator pokes at when
something's wrong. Recurring confusion today came from those two
living interleaved under "System/*".

### URL migration

For every old URL → new URL pair:

1. The new URL is the canonical home.
2. The old URL is registered as a 301 redirect via the existing
   `next.config.js` `redirects()` block — one extra block, no per-
   pane code change.
3. The shim ships for one release cycle (~2 months). After that, the
   redirects are dropped — anyone still hitting the old URL gets a
   normal 404 and updates their bookmark.
4. Inline references (admin docs, runbooks, code comments, agent prompts in `docs/`) are swept in the same commit.

### `<PaneHeader>` + `<EmptyState>` + `<SaveBar>`

Three shared components under `ui/admin/shell/` consumed by every
pane. Shape:

```tsx
<PaneHeader
  title={t('Invoices')}
  eyebrow={t('Commerce')}
  actions={<Button>Export period</Button>}
  breadcrumb={breadcrumb}
/>

<EmptyState
  icon={<FileTextOutlined/>}
  title={t('No invoices yet')}
  body={t('Invoices are generated automatically when a customer pays. Run a test order to see one here.')}
  action={<Button>How invoices work</Button>}
/>

<SaveBar
  dirty={form.isDirty}
  busy={saving}
  onSave={handleSave}
  onRevert={form.reset}
/>
```

The audit will surface ~30-50 pane files that need to swap their
hand-rolled header / empty / save patterns for the shared component.
Mechanical change; bulk-edit-able. Where a pane has a non-standard
header (e.g. tabbed surface), `<PaneHeader>` accepts a `slot`
prop for the override.

### Spacing rhythm

Establish a 4-token vertical rhythm:

- `--admin-rhythm-xs` (4px) — within-control spacing
- `--admin-rhythm-sm` (8px) — control-to-control
- `--admin-rhythm-md` (16px) — section-to-section within a pane
- `--admin-rhythm-lg` (32px) — pane-header-to-content, pane-bottom-to-savebar

Tokens declared in `ui/admin/styles/admin-rhythm.scss`; every pane
uses them via existing SCSS hooks. Where panes use inline `style={{margin:…}}`
or hardcoded px values, sweep to the tokens (lint rule in a follow-up).

## Files to touch (rough — refined during audit)

**New / created:**
- `docs/roadmap/_meta/admin-pane-inventory.md` — the audit table
- `ui/admin/shell/PaneHeader.tsx` + `PaneHeader.scss`
- `ui/admin/shell/EmptyState.tsx` + `EmptyState.scss`
- `ui/admin/shell/SaveBar.tsx` + `SaveBar.scss`
- `ui/admin/styles/admin-rhythm.scss`

**Modified:**
- `ui/admin/shell/AdminPageRegistry.ts` — new section structure
- `ui/admin/shell/AdminNavConfig.ts` (or equivalent) — sidebar tree
- `ui/admin/shell/Breadcrumbs.tsx` — match the new tree
- `ui/client/next.config.js` — 301 redirect shim block for old URLs
- Every pane file under `ui/admin/features/*` that uses a hand-rolled header / empty-state / save-row (~30-50 files; mechanical)
- Every admin route file under `ui/client/app/admin/**/page.tsx` whose URL changes (move or alias)
- Kbar action map — palette entries match the new URLs
- Inline doc references — `docs/info/*`, runbooks, agent-prompts

**Test files:** every visual baseline under `tests/e2e/visual/themes/`
and admin specs needs a re-baseline pass after the visual rhythm
changes land. Plan: ship the IA + sweep in one commit, run
`playwright test --update-snapshots`, eyeball the diff, commit the
new baselines separately.

## Dependencies

- **kbar command palette** — shipped; needs action-map sweep
- **admin dark mode audit** — shipped; visual rhythm needs to work in both modes (test both)
- **Sonner toast system** — shipped; `<SaveBar>` uses Sonner for the saved/error confirmation
- **admin-content-releases** — shipped; the Releases pane moves under `/admin/content/releases` per the new taxonomy
- **invoicing-and-bookkeeping** — shipped today; the Invoices pane moves under `/admin/commerce/invoices` per the new taxonomy (already lives there by coincidence — verify)
- **admin-permissions-ux** — shipped; the Permissions pane moves under `/admin/people/permissions`
- **mobile-friendly-admin** — separate roadmap; this jump's spacing-rhythm tokens make the mobile pass easier
- **admin-empty-states-onboarding** — shipped earlier; the `<EmptyState>` component replaces the per-pane empty patterns this jump captured

## Out of scope (carried)

- Re-implementing any pane's content beyond swapping header/empty/save shells
- Mobile-friendly admin — own jump
- Per-tenant nav customisation
- Adding new admin features

## Acceptance

- [ ] `docs/roadmap/_meta/admin-pane-inventory.md` lists every admin pane / dialog / drawer with settings-shaped content, old URL + new URL + mental-model bucket
- [ ] New top-level section structure visible in the admin sidebar — Site / Content / Commerce / People / Analytics / System / My account
- [ ] Every old admin URL 301s to its new home; verified by an e2e walking each redirect
- [ ] Every pane uses `<PaneHeader>`, `<EmptyState>` (where applicable), `<SaveBar>` (where applicable) — no hand-rolled equivalents remain
- [ ] Vertical rhythm tokens used consistently — no hardcoded `margin: 16px` / `padding: 24px` in admin pane SCSS or inline styles
- [ ] Kbar action map covers every pane; testids match
- [ ] Visual baselines re-captured for both light + dark mode
- [ ] No new features added — every regression test for existing admin behaviour still passes
- [ ] Admin docs + runbooks updated; broken links audit clean

## Effort

L-XL (1-3 days AI, possibly 3-5 if the audit surfaces more than ~50
panes to sweep). The audit alone is ~2-4 hours. The taxonomy decision
+ URL map is ~1 hour. The shared-component creation is ~2 hours. The
mechanical sweep is bulk-edit-able but every pane file needs a quick
visual eyeball after the swap. Visual-baseline re-capture is the
longest non-AI step.

## Operator post-merge ops

1. Walk the new admin once and confirm every settings surface you
   used to know how to find is still findable in its new home.
2. Update any bookmarks. (The 301 redirect shim covers you for one
   release cycle, but the canonical URL is the new one.)
3. Verify the operator-side runbooks point at the new URLs.
4. If you have agents / automations referencing admin URLs (the agent
   prompts in `docs/` use these), sweep them — the same commit
   includes that sweep, but if you've added private ones, check.

## Follow-up: per-area sweep

The IA jump shipped a hybrid scope (taxonomy + URL map + shim + 6
demonstrator panes). The remaining ~40 panes still:

1. Render hand-rolled headers / empty states / save rows that should
   adopt the new `<PaneHeader>` / `<EmptyState>` / `<SaveBar>` shapes.
2. Carry legacy `paneId` / `route` strings inside their
   `*AdminUILoader.ts` + `*AdminLoader.ts` pairs (e.g.
   `paneId: 'content/products'` should become `commerce/products` to
   match the new taxonomy + the URL the operator lands on after the
   301).

These break down per area. Each row is a small follow-up jump — one PR
per bucket is the suggested unit:

| Bucket | Demonstrator (done) | Remaining panes |
|---|---|---|
| **Site** | Footer | Themes, Logo, Layout, SEO defaults, Email config, Email templates, Compliance, Redirects, Languages, Account settings |
| **Content** | SystemPages | AdminApp (pages tree), Posts, Translations, Publishing, Releases, Trash |
| **Commerce** | Invoices | Products, Inventory, Orders, Settings, Abandoned cart, Checkout, Warehouse sync, Product templates |
| **People** | Users | Permissions, Inquiries, Auth |
| **Analytics** | AnalyticsPanel | Audit log, Attribution, SEO overview, Analytics filters |
| **System** | Diagnostics | MCP, Features, Errors, Agent, Performance, Backups, Bundle, Modules preview, Demo content (cars) |

Each per-area sweep covers:

- Swap pane chrome (`<PaneHeader>` + `<EmptyState>` where applicable +
  `<SaveBar>` where a VM exposes dirty-state).
- Update the bucket's loaders to the new paneId + route fields (drop
  the legacy view aliases from `AdminView` once empty).
- Move the bucket's App Router page directories to the new URLs (this
  jump only moved Footer / Users / Analytics / Diagnostics; the rest
  still serve from their legacy URLs and the redirect shim handles
  the new URLs).
- Add new entries to `adminAreaItems.ts` rails when appropriate.
- Re-baseline visual snapshots for that bucket.

The audit table at `docs/roadmap/_meta/admin-pane-inventory.md` is the
authoritative URL map — each sweep agent should consult it and tick
its rows off.

## Notes for the implementing agent

- Start with the audit. Don't propose the taxonomy until the audit is
  complete — surprises during sweep make the URL map churn.
- The Site / System split is the most important call to get right.
  When in doubt: "would an operator running the live site care about
  this?" → Site. "Is this a developer / power-user knob?" → System.
- Don't ship the shared-component swap and the URL move in the same
  commit — split into two for review (component shape changes first,
  then mechanical URL moves on top).
- Visual baselines: the rhythm tokens will move pixels everywhere.
  Plan for a 200-300 snapshot re-baseline. Don't try to keep the old
  baselines green.
