# Admin segregation — six concern areas

Status: Planned
Last updated: 2026-04-30
Related: [admin-ui-modes.md](admin-ui-modes.md), [service-modularity.md](service-modularity.md), [../core/admin-experience.md](../core/admin-experience.md)

## Why

The admin shell has accreted 17+ tabs across 3 routes (`/admin`, `/admin/settings`, `/admin/languages`). The settings pane alone has 13 tabs ordered by historical accretion, not by concern. New operators face a flat list with no mental model — "where do I publish?" is a tab-hunt; "where do I add a user?" is a tab-hunt; users / themes / posts / products / footer all sit at the same level.

This spec collapses the surface into **six top-level concern areas**, each owning a coherent slice of the admin. Each area becomes its own URL prefix and its own top-level navigation entry; sub-tabs only exist within an area.

The grouping mirrors how operators actually work — a marketing person spends 90% of their time in Content; a release manager in Versioning; a developer in Admin management. Today they all see the same 13 tabs.

## The six areas

| Area | Owns | URL | Audience |
|---|---|---|---|
| **Page building** | The visible structure of pages — sections, modules, page-level preview / style matrix | `/admin/build` | Content authors, designers |
| **Client configuration** | What the public site looks like and behaves like — themes, logo, layout mode (tabs vs scroll), Google Fonts | `/admin/client-config` | Designers, brand owners |
| **Content management** | The text/data that fills those pages — translations, blog posts, footer copy, products, inventory, orders | `/admin/content` | Marketing, support, merchandising |
| **SEO** | Site-wide SEO + per-page SEO metadata, sitemap, robots, OG images | `/admin/seo` | Marketing, growth |
| **Versioning · publishing · auditing** | Snapshots / rollback, bundle export/import, audit log | `/admin/release` | Release managers, ops |
| **Admin side management** | Users + roles, MCP tokens, inquiries | `/admin/system` | Admins only |

## Current → proposed mapping

The existing tabs and routes get re-homed as follows. **No functionality moves**; only navigation hierarchy changes.

### Page building (`/admin/build`)

| Today | Lives at |
|---|---|
| `/admin` (App building shell — sidebar pages + section editor) | `/admin/build` (becomes the area's home) |
| `/admin/modules-preview` (Style matrix) | `/admin/build/modules-preview` |
| Top-bar Preview button | unchanged (cross-area) |

### Client configuration (`/admin/client-config`)

| Today | Lives at |
|---|---|
| `/admin/settings` → Theme | `/admin/client-config/themes` |
| `/admin/settings` → Logo | `/admin/client-config/logo` |
| `/admin/settings` → Layout (site-wide layout mode) | `/admin/client-config/layout` |
| Google Fonts picker (currently embedded in Theme) | stays where it is structurally; surfaces under this area |

### Content management (`/admin/content`)

| Today | Lives at |
|---|---|
| `/admin/languages` | `/admin/content/translations` |
| `/admin/settings` → Posts | `/admin/content/posts` |
| `/admin/settings` → Footer | `/admin/content/footer` |
| `/admin/settings` → Products | `/admin/content/products` |
| `/admin/settings` → Inventory | `/admin/content/inventory` |
| `/admin/settings` → Orders | `/admin/content/orders` |

### SEO (`/admin/seo`)

| Today | Lives at |
|---|---|
| `/admin/settings` → SEO (site-wide) | `/admin/seo` (overview + site fields) |
| Per-page SEO fields (currently inside the Page edit drawer in `AddNewDialogNavigation.tsx`) | `/admin/seo/pages` (cross-page table view) — **consolidated here**, removed from the Page-edit drawer |

### Versioning · publishing · auditing (`/admin/release`)

| Today | Lives at |
|---|---|
| `/admin/settings` → Publishing | `/admin/release/publishing` |
| `/admin/settings` → Bundle | `/admin/release/bundle` |
| `/admin/settings` → Audit | `/admin/release/audit` |
| Top-bar Publish button | unchanged (visible everywhere with `canPublishProduction`) |

### Admin side management (`/admin/system`)

| Today | Lives at |
|---|---|
| `/admin/settings` → Users | `/admin/system/users` |
| `/admin/settings` → MCP | `/admin/system/mcp` |
| `/admin/settings` → Inquiries | `/admin/system/inquiries` |

Site flags (currently scattered) and any future operator-only knobs land here too.

## Top-bar restructure

Today's top bar surfaces five entries in one row: `App Building / Site Settings / Languages / Style Matrix / Preview / Blog / Command`. After segregation:

```
[Build] [Client config] [Content] [SEO] [Release] [System]    [Preview] [Command] [Sign out]
```

Six area buttons on the left (matching the six `URL` prefixes), three cross-area utility buttons on the right. Each area button highlights when its prefix is active.

## Permission gates

Today's per-tab `role === 'admin'` checks become per-area:

- **Page building** — editor+
- **Client configuration** — editor+ (themes / logo are visual config, editor-grade)
- **Content management** — editor+ for most; Orders gates refunds to admin
- **SEO** — editor+
- **Release** — admin (Bundle, Audit) or editor with `canPublishProduction` (Publishing)
- **Admin side management** — admin only (Users, MCP, Inquiries triage)

Editors landing on `/admin/system` get the same redirect-to-Build behavior `/account/*` gives to admins (different population, wrong door).

## Implementation strategy

**Phase 1 — additive routes, keep old.** Add the five area routes as new pages that render the same panes as today. Old `/admin/settings/<tab>` URLs keep working and 302-redirect to the new path. No JSX restructure; just route mapping + sidebar nav.

**Phase 2 — restructure top bar.** Replace the seven-entry top nav with the five area buttons + three utility buttons. Existing tab labels become sub-nav inside each area.

**Phase 3 — drop old routes.** After two release cycles, remove the redirects and the old URLs. Bookmarks land on the new structure.

This is sequenced specifically so step 1 ships immediately (zero behavior change for users still using old URLs) and steps 2/3 ride a separate release.

## Open questions

1. **Layout-mode placement** — site-wide layout (tabs vs scroll) is in Client configuration here. Per-section column count / slots is a property of the section itself and stays in the Page-building section editor. Confirm the boundary.
2. **Per-page SEO drawer removal.** Per-page SEO fields move from the Page-edit drawer (`AddNewDialogNavigation.tsx`) to the new `/admin/seo/pages` table. Operators editing a page no longer touch SEO inline; they jump to SEO. Does that match the intended flow, or should the drawer keep a "Quick SEO" affordance with a "Full editor" link?
3. **Search across areas.** With six areas, an operator who knows what they want shouldn't have to remember which area owns it. Add a global Cmd+K-style search that resolves to the right area. Already partly satisfied by the existing `Command` palette — extend it to surface area-prefixed routes.
4. **Audit visibility.** Audit log under Release is technically correct but behaviourally annoying (an editor might want to check who edited a section without leaving Build). Compromise: per-feature audit drawers (existing `<AuditBadge>` already shows recent activity inline) for in-flow checks, and `/admin/release/audit` for the full log.
5. **Inquiries triage state machine.** Once segregation lands, inquiries living under Admin management opens the door to a proper triage UI (status: new / in-progress / resolved / spam). Out of scope for the segregation itself; tracked as a follow-up.

## What this doesn't change

- The underlying GraphQL surface, services, or testids. The segregation is a UI / nav-tree refactor, not a code re-org.
- The MCP server's tool catalogue. Tools stay namespaced by domain (`page.*`, `theme.*`, `bundle.*`, `audit.*`, `e2e.*`) — closer to the new area mapping than to the old tab labels.
- The e2e smoke / chain spec navigation. Specs use testids, not URL paths, so the segregation lands without spec rewrites (the `admin-settings-tab-<x>` testids continue to identify panes regardless of URL prefix).
- The first-boot admin password / setup flow.
