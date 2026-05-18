# Admin pane inventory

Snapshot of every admin pane / dialog / drawer with settings-shaped
content. Drives the `admin-information-architecture` jump's URL map +
the per-area sweep follow-ups.

Captured 2026-05-16. **Re-pivoted same day** from the first-shipped
6-bucket noun taxonomy (Site / Content / Commerce / People / Analytics
/ System) to the 5-bucket task-driven taxonomy below. Sources:
`ui/admin/lib/loaders/adminUILoaderRegistry.ts` (46 registered
`AdminUILoader`s) + the legacy switch in
`ui/admin/shell/UserStatusBar.tsx` + the area rails in
`ui/admin/shell/AdminTopBar/adminAreaItems.ts`.

## Top-level taxonomy (refined 2026-05-16)

Five task-driven buckets, each with a single canonical URL prefix.
Settings is hierarchical (sub-paths beneath the prefix).

| Bucket | Prefix | Operator mental model |
|---|---|---|
| **Build** | `/admin/build/*` | Compose the site's page tree from modules (single page — the AdminApp page editor) |
| **Content** | `/admin/content/*` | Author the content the site shows — pages, posts, products, inventory, orders, invoices, customers, inquiries, translations, releases, trash, system pages |
| **Settings** | `/admin/settings/*` | Configure how everything works (hierarchical) — chrome (header / logo / footer co-located), theme, languages, SEO defaults, features/* (one page per feature = enable + config), access (admin users + permissions + auth), account |
| **Analytics** | `/admin/analytics/*` | See what happened — overview, SEO health, audit log, attribution, filters |
| **System** | `/admin/system/*` | Power-user / dev tools — MCP, feature-flag registry, diagnostics, errors, performance, backups, bundle, modules preview, demo content (cars) |

### Settings sub-structure

```
/admin/settings/
├── chrome/           ← Header + Logo + Footer co-located
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

## Pane inventory + URL map

| Old URL (pre-IA) | Loader id (new) | Pane | Bucket | New URL (5-bucket) | Notes |
|---|---|---|---|---|---|
| `/admin/build` | `content/pages` | AdminApp navigation tree | Build | `/admin/build` | Build bucket is single-page — page-tree editor stays at `/admin/build` |
| `/admin/build/modules-preview` | `system/modules-preview` | Modules style matrix | System | `/admin/system/modules-preview` | Dev tool — not operator-facing |
| `/admin/modules-preview` | (legacy alias) | Modules style matrix | System | `/admin/system/modules-preview` | 301 → canonical |
| `/admin/client-config/themes` | `settings/theme` | Theme picker | Settings | `/admin/settings/theme` | Themes + Layout merge under one sub-page |
| `/admin/client-config/logo` | `settings/chrome/logo` | Logo upload | Settings | `/admin/settings/chrome/logo` | Co-located with Header + Footer |
| `/admin/client-config/site-layout` | `settings/theme` | Header / nav layout | Settings | `/admin/settings/theme` | Folded into Theme |
| `/admin/client-config/commerce` | `settings/features/commerce` | Commerce settings (currency, regime) | Settings | `/admin/settings/features/commerce` | Each feature = enable + config |
| `/admin/client-config/abandoned-cart` | `settings/features/commerce` | Abandoned cart recovery | Settings | `/admin/settings/features/commerce` | Folded into the Commerce feature page |
| `/admin/client-config/checkout` | `settings/features/commerce` | Checkout chrome customisation | Settings | `/admin/settings/features/commerce` | Folded into the Commerce feature page |
| `/admin/content/translations` | `content/translations` | Translation entries | Content | `/admin/content/translations` | No change |
| `/admin/content/posts` | `content/posts` | Blog posts CRUD | Content | `/admin/content/posts` | No change |
| `/admin/content/footer` | `settings/chrome/footer` | Footer columns + bottom line | Settings | `/admin/settings/chrome/footer` | **DEMONSTRATOR** — Footer is global site chrome |
| `/admin/content/products` | `content/products` | Products CRUD | Content | `/admin/content/products` | Products are a content list (Content bucket absorbs Commerce CRUDs) |
| `/admin/content/inventory` | `content/inventory` | Inventory levels | Content | `/admin/content/inventory` | |
| `/admin/content/orders` | `content/orders` | Order list | Content | `/admin/content/orders` | |
| `/admin/content/cars` | `system/demo-content/cars` | Demo cars seed | System | `/admin/system/demo-content/cars` | Demo content — grouped out of main flow |
| `/admin/content/system-pages` | `content/system-pages` | System pages registry | Content | `/admin/content/system-pages` | **DEMONSTRATOR** — no URL change |
| `/admin/content/warehouse-sync` | `settings/features/dropship` | Wholesale warehouse sync | Settings | `/admin/settings/features/dropship` | Folded into the Dropship feature page |
| `/admin/content/product-templates` | `content/products/templates` | Product seed templates | Content | `/admin/content/products/templates` | Sub-shape of products |
| `/admin/seo` | `settings/seo` | SEO defaults config | Settings | `/admin/settings/seo` | Site-wide SEO defaults |
| `/admin/seo/analytics` | `analytics` | Analytics dashboard | Analytics | `/admin/analytics` | **DEMONSTRATOR** — becomes the Analytics bucket landing |
| `/admin/release/audit` | `analytics/audit-log` | Audit log | Analytics | `/admin/analytics/audit-log` | Read-only insight surface |
| `/admin/release/bundle` | `system/bundle` | Bundle export / import | System | `/admin/system/bundle` | Power-user / dev tool |
| `/admin/release/publishing` | `content/publishing` | Publish to production | Content | `/admin/content/publishing` | Publishing is content-shipping |
| `/admin/release/releases` | `content/releases` | Atomic releases | Content | `/admin/content/releases` | Content versioning |
| `/admin/release/trash` | `content/trash` | Soft-deleted items | Content | `/admin/content/trash` | |
| `/admin/system/users` | `settings/access/users` | Admin users | Settings | `/admin/settings/access/users` | **DEMONSTRATOR** — Admin access is configuration |
| `/admin/system/email` | `settings/features/email` | SMTP / email config | Settings | `/admin/settings/features/email` | Folded into the Email feature page |
| `/admin/system/email-templates` | `settings/features/email` | Email templates editor | Settings | `/admin/settings/features/email` | Folded into the Email feature page |
| `/admin/system/inquiries` | `content/inquiries` | Inbound contact-form messages | Content | `/admin/content/inquiries` | List operators view/filter/act on |
| `/admin/system/features` | `system/features` | Feature flag registry | System | `/admin/system/features` | Power-user audit view — per-feature config moves to Settings/features/* |
| `/admin/system/mcp` | `system/mcp` | MCP tokens + tools | System | `/admin/system/mcp` | No change |
| `/admin/system/analytics-filters` | `analytics/filters` | Analytics filter rules | Analytics | `/admin/analytics/filters` | |
| `/admin/system/agent` | `system/agent` | AI agent console | System | `/admin/system/agent` | No change |
| `/admin/system/errors` | `system/errors` | Error log | System | `/admin/system/errors` | No change |
| `/admin/system/info` | `system/diagnostics` | Diagnostics | System | `/admin/system/diagnostics` | **DEMONSTRATOR** — renamed from `info` |
| `/admin/system/performance` | `system/performance` | Perf beacons | System | `/admin/system/performance` | No change |
| `/admin/system/account-settings` | `settings/account` | Operator account UX config | Settings | `/admin/settings/account` | Operator-side profile |
| `/admin/system/auth` | `settings/features/auth` | Auth diagnostics + provider toggles | Settings | `/admin/settings/features/auth` | Folded into the Auth feature page |
| `/admin/system/backups` | `system/backups` | Backup runs | System | `/admin/system/backups` | No change |
| `/admin/system/compliance` | `settings/features/compliance` | GDPR / cookie consent toggles | Settings | `/admin/settings/features/compliance` | Folded into the Compliance feature page |
| `/admin/system/permissions` | `settings/access/permissions` | Permission grants matrix | Settings | `/admin/settings/access/permissions` | Co-located with admin users |
| `/admin/system/redirects` | `settings/features/redirects` | URL redirects | Settings | `/admin/settings/features/redirects` | Folded into the Redirects feature page |
| `/admin/system/seo` | `analytics/seo` | SEO health overview | Analytics | `/admin/analytics/seo` | SEO split — defaults at Settings/seo, overview here |
| `/admin/marketing/attribution` | `analytics/attribution` | Marketing attribution | Analytics | `/admin/analytics/attribution` | "Marketing" bucket dropped; folds into Analytics |
| `/admin/onboarding` | `onboarding` | First-run wizard | (top-level) | `/admin/onboarding` | No change — wizard is its own surface |
| (new) | `content/invoices` | Invoices list | Content | `/admin/content/invoices` | **DEMONSTRATOR** — moved from first-ship `/admin/commerce/invoices` |
| (new) | `content/customers` | Customer list | Content | `/admin/content/customers` | Customers are a list operators view, not a config surface |

**Total panes**: 46 (44 registered loaders + 2 legacy/standalone views).

## First-ship → re-pivot delta

The 6-bucket first ship's three dissolved buckets fan out as follows:

- **Site bucket** → Settings (`chrome` / `theme` / `seo` / `languages`)
  or Settings/features/* per feature (`email` / `compliance` / `redirects`)
- **Commerce bucket** → Content (`products` / `inventory` / `orders` /
  `invoices` — author-facing lists) or Settings/features/commerce +
  Settings/features/dropship (the configuration surfaces)
- **People bucket** → Settings/access (`users` / `permissions` / `auth`)
  for admin-side; Content (`customers` / `inquiries`) for the
  author-facing lists

## SEO double-home — design choice

Two SEO panes, two homes:

- **`/admin/settings/seo`** — *SEO defaults config*. Operator setting
  up per-page title templates, OG defaults, robots policy. Configuration.
- **`/admin/analytics/seo`** — *SEO health overview*. Operator checking
  whether pages are indexable, sitemap fresh, schema valid. Insight.

## Top-bar buttons (operator-visible chrome)

Five buttons in the admin top bar, in this left-to-right order:

1. **Build** — page-tree editor
2. **Content** — pages, posts, products, orders, invoices, customers,
   inquiries, translations, releases, trash, system pages
3. **Settings** — hierarchical configuration (chrome / theme / languages
   / seo / features/* / access / account)
4. **Analytics** — dashboard, SEO health, audit log (advanced-only)
5. **System** — dev / power-user knobs (advanced-only)

Simplified-mode authors see three buttons (Build / Content / Settings).

## Follow-up sweep — per-area work

This jump's commits adopted the new shared components in six
demonstrator panes (one per bucket pre-re-pivot — Footer, SystemPages,
Invoices, Users, Analytics, Diagnostics). The remaining ~40 panes still
render hand-rolled headers / empty states / save rows. Per-area sweep
agents pick up from here:

| Bucket | Demonstrator | Remaining panes to sweep |
|---|---|---|
| Content | SystemPagesPanel, InvoicesListPane | AdminApp (page tree — under Build now), Posts, Products, Inventory, Orders, Customers, Inquiries, Translations, Publishing, Releases, Trash |
| Settings | Footer, Users | Chrome (Header / Logo), Theme, Languages, SEO defaults, Features/* (Auth / Commerce / Dropship / Email / Compliance / Redirects), Access/permissions, Access/auth, Account |
| Analytics | AnalyticsPanel | Audit log, Attribution, SEO overview, Analytics filters |
| System | Diagnostics | MCP, Features registry, Errors, Agent, Performance, Backups, Bundle, Modules preview, Demo content (cars) |

Each pane swaps its hand-rolled chrome for `<PaneHeader>` /
`<EmptyState>` / `<SaveBar>` from `ui/admin/shell/`. Mechanical
change; one PR per area is the suggested unit.

## Legacy redirect shim

Old URLs 301 to their new home via `ui/client/next.config.js`
`redirects()`. The shim ships for one release cycle (~2 months) and is
then dropped.

**Scope note (2026-05-16):** the IA re-pivot landed redirects only for
the demonstrator panes whose loaders + App Router page directories
actually moved (Footer, Users, Invoices, Analytics dashboard,
Diagnostics) PLUS direct redirects for the first-ship 6-bucket URLs
(`/admin/site`, `/admin/commerce`, `/admin/people` and their
demonstrator sub-paths) so anyone bookmarked from yesterday's first
ship still works. The remaining buckets' redirects land alongside their
per-area sweep — adding a redirect before the destination directory
exists 404s the operator.

Currently-redirected legacy URLs:

| Old URL | New URL |
|---|---|
| `/admin/content/footer` | `/admin/settings/chrome/footer` |
| `/admin/site/footer` | `/admin/settings/chrome/footer` |
| `/admin/site` | `/admin/settings/chrome/footer` |
| `/admin/system/users` | `/admin/settings/access/users` |
| `/admin/people/users` | `/admin/settings/access/users` |
| `/admin/people` | `/admin/settings/access/users` |
| `/admin/commerce/invoices` | `/admin/content/invoices` |
| `/admin/commerce` | `/admin/content/invoices` |
| `/admin/seo/analytics` | `/admin/analytics` |
| `/admin/system/info` | `/admin/system/diagnostics` |

(Pre-existing redirects from earlier segregation jumps — `/admin/languages`,
`/admin/modules-preview` — remain in place. The `/admin/settings` →
`/admin/build` redirect from Phase 2 of admin segregation is dropped:
`/admin/settings` is now a top-level bucket landing.)

The remaining rows in the inventory table are aspirational URLs that
land when their bucket's per-area sweep ships.
