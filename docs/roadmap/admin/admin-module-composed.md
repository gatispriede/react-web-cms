---
name: admin-module-composed
description: Every admin pane is composed of admin modules — extract existing pane content into reusable modules, then re-compose each pane via the same system-page mechanism customer pages use. /admin/build (the page-section editor) is the only exempt surface because it IS the meta-editor.
filed: 2026-05-13 by operator feedback: "even admin should be made of our modules, hence we can create modules from existing content in admin, except for build page that is unique"
---

> **✅ SHIPPED 2026-05-14.** Admin module-compose infrastructure
> (`AdminLoader` bridge · `AdminPageRegistry` · `AdminPageDispatch` ·
> `EAdminModuleType`) + 7 view-module shapes (`AdminInfo` / `AdminCrudList`
> / `AdminForm` / `AdminActionPanel` / `AdminWizard` / `AdminPreview` /
> `AdminConflict`) under `ui/admin/modules/shapes/`. All ~36 in-scope
> admin panes converted — each pane file is now its `AdminLoader` bridge,
> ViewModels untouched, dispatching through the registry. The 10 exempt
> surfaces (`/admin/build`, Navigation, shell, signin, Translations,
> Agent, ThingsToDo, Dialogs, inline-edit overlay, ConflictDialog inline
> sites) stay hand-coded per the table below.

# Admin module-composition

## Goal

The 40+ admin features under `ui/admin/features/*` are currently hand-coded React panes. Refactor each into the **module-compose** shape that customer pages already use:

1. Extract the unique content of each pane into one or more **admin modules** (small, reusable, registry-driven components — same pattern as the catalogue modules under `ui/client/modules/*`).
2. Register each admin pane as a **system page** for the admin surface.
3. Render the pane by dispatching its registered modules in sequence.

Once every admin pane is module-composed, operators can re-arrange admin dashboards, plug in new modules, and the admin chrome inherits the same composability promise the public site already has.

## The exception — `/admin/build`

The page-section editor (`/admin/build`) is **explicitly out of scope** for this refactor. It IS the meta-editor — the surface where operators drag-reorder, add, remove, and edit the very modules every other page composes from. Trying to module-compose `/admin/build` itself is infinite regress (you'd need a build-page-for-the-build-page editor). The editor canvas + module library sidebar + drag/drop wiring stay hand-coded.

Everything else in admin is fair game — **except the surfaces listed below where module-composition doesn't fit.**

## Other admin areas explicitly out of scope

Operator decision 2026-05-13: "leave parts that don't make sense being modules in admin alone." The following stay hand-coded for the reasons listed; the rest of the admin surface is in scope.

| Area | Path / feature dir | Why exempt |
| --- | --- | --- |
| **Page-section editor** | `/admin/build` + `ui/admin/features/Pages/*` | Meta-editor for every other page; infinite regress if module-composed. |
| **Navigation tree editor** | `ui/admin/features/Navigation/Layout.tsx` | Tightly coupled to the page-section editor (sets parent / slug / nav-order on pages). Same meta-editor reason as `/admin/build`. |
| **Admin shell + chrome** | `ui/admin/shell/*` (AdminApp, top bar, sider, drawer, command palette, presence bar, inline-edit overlay) | The shell hosts every other admin pane. Can't be composed of modules that the shell itself renders — chicken-and-egg. |
| **Admin sign-in** | `pages/admin/signin.tsx` | Auth surface; rendered outside the SessionProvider tree, can't safely depend on shell state. Same reason `/account/signin` is being module-composed *carefully* on the customer side — admin signs in on a stricter path. |
| **Admin Translations editor** | `ui/admin/features/Translations/*`, `ui/admin/features/Languages/Languages.tsx` | The translation editor's whole UX is "edit JSON live + flip languages via sidebar." Suspense-driven loader, fixed-language `getFixedT` resolution, conflict-dialog flow — the surface is bespoke enough that an `AdminFormModule` shape wouldn't fit. |
| **MCP agent stream** | `ui/admin/features/Agent/AgentPanel.tsx` | SSE event stream + token-by-token diff reconciliation + streaming tool-call surface. Real-time wire protocol; doesn't fit any of the 7 candidate module shapes. |
| **Conflict dialog** | `ui/client/lib/ConflictDialog.tsx` + per-feature inlines | Modal that mediates optimistic-locking version conflicts; reads peer-version + offers take-mine / take-theirs / merge. Composed inline by mutations across many panes — refactoring is a centralisation jump but not a module-compose jump per se. |
| **Inline-edit overlay** | `ui/admin/shell/InlineEdit/*` | Renders editable highlight pills over the public site when admin is signed in. Lives in the shell layer (per `_app.tsx`); not a pane. |
| **Modal dialogs (AddNewSectionItem, etc.)** | `ui/admin/features/Dialogs/*` | Imperative dialogs invoked from across the admin; not page-level surfaces. |
| **Diagnostics live probes** | `/admin/system/info` HEAD-probes block in `ui/admin/features/Diagnostics/*` | The "route registry HEAD-probes" subsection fans out N parallel HEAD requests per render. Wrappable as an `AdminInfoModule` only if the probe-fanout state is hoisted to a VM — and that VM doesn't compose; it IS the surface. |
| **Things-to-do panel** | `ui/admin/features/ThingsToDo/*` | Heuristic-driven action feed that reads from every other service; the dispatch logic IS the panel. No clean module-shape fit. |

These 10 surfaces remain hand-coded. Every other admin feature dir is in scope — same patterns the spec already lists (CRUD lists, single-doc forms, info surfaces, action panels, wizards, previews).

## Existing admin surface

Inventory at 2026-05-13 (40 feature dirs under `ui/admin/features/`):

```
Agent · Analytics · Audit · Auth · Bundle · Cars · Checkout · Commerce ·
Compliance · CustomerAccountSettings · Diagnostics · Dialogs · Email ·
Footer · Inquiries · Inventory · Languages · Logo · Mcp · Navigation ·
Observability · Onboarding · Orders · Pages · Permissions · Platform ·
Posts · ProductTemplates · Products · Publishing · ...
```

And the URL surface (`ui/client/pages/admin/`):

```
/admin/build               ← EXEMPT (meta-editor)
/admin/client-config/*     ← module-compose
/admin/content/*           ← module-compose
/admin/languages           ← module-compose
/admin/modules-preview     ← module-compose
/admin/onboarding          ← module-compose
/admin/release/*           ← module-compose
/admin/seo/*               ← module-compose
/admin/settings            ← module-compose
/admin/system/*            ← module-compose
```

## Admin module patterns to extract

Most admin panes follow one of a handful of shapes. Each shape → one new admin module class:

| Shape | Existing examples | New admin module |
| --- | --- | --- |
| CRUD list with row actions | Users, Posts, Products, Orders, Themes, Languages, Inquiries, Permissions | `AdminCrudListModule` (generic) — specialised via prop config (columns, row actions, filters) |
| Single-doc form editor | Email config, SEO defaults, Site flags, Logo | `AdminFormModule` — JSON-schema-driven inputs + Save action + audit badge |
| Read-only info surface | Diagnostics, Audit log, Errors panel, Build identity, MCP tokens snapshot | `AdminInfoModule` — sections with headings + key-value pairs + status pills |
| Import / export action panel | Bundle, Themes import/export | `AdminActionPanelModule` — file drop / picker + progress + result summary |
| Wizard / multi-step | Onboarding | `AdminWizardModule` — step indicator + per-step form + Next/Back |
| Embedded preview | Modules preview, Template preview, Theme preview | `AdminPreviewModule` — iframe / slot + theme picker + viewport toggle |
| Conflict surface | ConflictDialog | `AdminConflictModule` — peer-diff display + take-mine / take-theirs / merge |

Per pane: pick the shape, parameterise the module with the pane's specific data, register both via an admin loader.

## Composition contract

```ts
// services/features/Admin/SystemPageRegistry — analogous to Phase 1.D's
// customer-side SystemPageRegistry but scoped to /admin/* routes.

interface AdminSystemPage {
    key: string;                        // e.g. 'admin-users', 'admin-email-config'
    route: string;                      // e.g. '/admin/system/users'
    sections: AdminSection[];           // ordered list of modules
}

interface AdminSection {
    moduleType: EAdminItemType;         // e.g. 'AdminCrudList', 'AdminInfoModule'
    locked: boolean;                    // operator can't delete / move locked sections
    content: any;                       // module-specific config
}
```

Per page, the bootBootstrap path seeds the canonical layout (mirrors what the hand-coded JSX rendered before). Operators can rearrange unlocked sections via the same admin section editor used for customer pages.

## Slicing (recommended order)

Prioritise by leverage: every refactored pane reduces hand-coded admin surface AND seeds reusable admin modules for downstream panes.

1. **Read-only info surfaces first** — Diagnostics, Audit, Errors. Lowest risk; shape (`AdminInfoModule`) is simplest. After this, the pattern is proven for the harder shapes.
2. **CRUD lists** — Users, Posts, Products, Themes, Languages, Orders, Inquiries, Permissions. The biggest visible payoff; `AdminCrudListModule` covers them all once parameterised right.
3. **Single-doc forms** — Email config, SEO defaults, Site flags, Logo.
4. **Action panels** — Bundle import/export, Themes import/export.
5. **Wizards + previews** — Onboarding, Modules-preview, Template-preview, Theme-preview.
6. **Conflict surface** — last; ConflictDialog is currently inline in many places; centralising it into a single module is a separate cleanup.

## Acceptance

1. Every admin URL except `/admin/build` renders via an admin-system-page registration + module dispatch.
2. ~7 new admin-module classes ship in `ui/admin/modules/*` (mirror to `ui/client/modules/*` shape).
3. The hand-coded `ui/admin/features/<Name>/<Name>.tsx` pane files become thin wrappers that just configure the relevant module (or are deleted entirely when 100% covered).
4. `/admin/build` continues to work unchanged — it remains the meta-editor for both customer pages AND the new admin-system-page registrations.

## Effort

**XL** (multi-week). The 7 module shapes + 30+ pane refactors don't compress easily, but each pane is its own S-M jump once the patterns land.

## Dependencies

- Phase 1.D `SystemPageRegistry` shape — adapt for admin surface.
- AdminUILoader infrastructure already wires admin panes; this jump retires the per-feature `<Name>.tsx` hand-coded panes and replaces them with module dispatch.

## Out of scope

- `/admin/build` (the page-section editor) — explicit exemption per the operator decision.
- `/admin/signin` — auth surface; route through the customer signin pattern instead (separate jump).
- Any admin-only mutation logic — extracted modules call existing services + VMs unchanged.
- Themes don't apply to admin chrome by default; that's a separate concern. (Admin dark-mode audit is a separate roadmap item.)

## Related

- [all-pages-module-composed.md](../platform/all-pages-module-composed.md) — companion jump for customer pages. Same philosophy; same architectural primitive (`SystemPageRegistry` + module dispatch).
- [radical-per-module-theme-variants](../../ROADMAP.md) — per-theme module variations only apply to customer surfaces (admin chrome is theme-agnostic).
