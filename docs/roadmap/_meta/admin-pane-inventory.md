# Admin pane inventory

Snapshot of every admin pane / dialog / drawer with settings-shaped
content. Drives the `admin-information-architecture` jump's URL map +
the per-area sweep follow-ups.

Captured 2026-05-16. Sources: `ui/admin/lib/loaders/adminUILoaderRegistry.ts`
(46 registered `AdminUILoader`s) + the legacy switch in
`ui/admin/shell/UserStatusBar.tsx` + the area rails in
`ui/admin/shell/AdminTopBar/adminAreaItems.ts`.

## Top-level taxonomy

Six operator-facing buckets, each with a single canonical URL prefix:

| Bucket | Prefix | Operator mental model |
|---|---|---|
| **Site** | `/admin/site/*` | Global site config — logo, theme, domain, footer, languages, SEO defaults, email config, compliance, redirects |
| **Content** | `/admin/content/*` | What the customer reads — pages, posts, translations, releases, publishing, trash, system pages |
| **Commerce** | `/admin/commerce/*` | Selling — products, inventory, orders, invoices, abandoned carts, checkout chrome, warehouse sync, payment/shipping rules |
| **People** | `/admin/people/*` | Humans + access — admin users, customer accounts, permissions, sessions, inquiries, auth diagnostics |
| **Analytics** | `/admin/analytics/*` | Read-only insight — traffic dashboard, SEO overview, audit log, attribution, analytics filters |
| **System** | `/admin/system/*` | Dev / power-user knobs — feature flags, MCP, agent console, diagnostics, error log, performance, backups, bundle import/export, demo content, modules preview |

## Pane inventory + URL map

| Old URL | Loader id (new) | Pane | Bucket | New URL | Notes |
|---|---|---|---|---|---|
| `/admin/build` | `content/pages` | AdminApp navigation tree | Content | `/admin/content/pages` | Legacy "Build" framing dropped — pages are content |
| `/admin/build/modules-preview` | `system/modules-preview` | Modules style matrix | System | `/admin/system/modules-preview` | Dev tool — not operator-facing |
| `/admin/modules-preview` | (legacy alias) | Modules style matrix | System | `/admin/system/modules-preview` | 301 → canonical |
| `/admin/client-config/themes` | `site/themes` | Theme picker | Site | `/admin/site/themes` | |
| `/admin/client-config/logo` | `site/logo` | Logo upload | Site | `/admin/site/logo` | |
| `/admin/client-config/site-layout` | `site/layout` | Header / nav layout | Site | `/admin/site/layout` | |
| `/admin/client-config/commerce` | `commerce/settings` | Commerce settings (currency, regime) | Commerce | `/admin/commerce/settings` | |
| `/admin/client-config/abandoned-cart` | `commerce/abandoned-carts` | Abandoned cart recovery | Commerce | `/admin/commerce/abandoned-carts` | |
| `/admin/client-config/checkout` | `commerce/checkout` | Checkout chrome customisation | Commerce | `/admin/commerce/checkout` | |
| `/admin/content/translations` | `content/translations` | Translation entries | Content | `/admin/content/translations` | No change |
| `/admin/content/posts` | `content/posts` | Blog posts CRUD | Content | `/admin/content/posts` | No change |
| `/admin/content/footer` | `site/footer` | Footer columns + bottom line | Site | `/admin/site/footer` | Footer is global site chrome, not page content |
| `/admin/content/products` | `commerce/products` | Products CRUD | Commerce | `/admin/commerce/products` | Products are a commerce concept |
| `/admin/content/inventory` | `commerce/inventory` | Inventory levels | Commerce | `/admin/commerce/inventory` | |
| `/admin/content/orders` | `commerce/orders` | Order list | Commerce | `/admin/commerce/orders` | |
| `/admin/content/cars` | `system/demo-content/cars` | Demo cars seed | System | `/admin/system/demo-content/cars` | Demo content — grouped out of main flow |
| `/admin/content/system-pages` | `content/system-pages` | System pages registry | Content | `/admin/content/system-pages` | No change |
| `/admin/content/warehouse-sync` | `commerce/warehouse-sync` | Wholesale warehouse sync | Commerce | `/admin/commerce/warehouse-sync` | |
| `/admin/content/product-templates` | `commerce/product-templates` | Product seed templates | Commerce | `/admin/commerce/product-templates` | |
| `/admin/seo` | `site/seo` | SEO defaults config | Site | `/admin/site/seo` | Operator-facing config |
| `/admin/seo/analytics` | `analytics` | Analytics dashboard (home) | Analytics | `/admin/analytics` | Becomes the Analytics bucket landing |
| `/admin/release/audit` | `analytics/audit-log` | Audit log | Analytics | `/admin/analytics/audit-log` | Audit log is a read-only insight surface |
| `/admin/release/bundle` | `system/bundle` | Bundle export / import | System | `/admin/system/bundle` | Power-user / dev tool |
| `/admin/release/publishing` | `content/publishing` | Publish to production | Content | `/admin/content/publishing` | Publishing the site is content-shipping |
| `/admin/release/releases` | `content/releases` | Atomic releases | Content | `/admin/content/releases` | Content versioning |
| `/admin/release/trash` | `content/trash` | Soft-deleted items | Content | `/admin/content/trash` | |
| `/admin/system/users` | `people/users` | Admin users | People | `/admin/people/users` | |
| `/admin/system/email` | `site/email` | SMTP / email config | Site | `/admin/site/email` | Transactional email is site-level |
| `/admin/system/email-templates` | `site/email-templates` | Email templates editor | Site | `/admin/site/email-templates` | |
| `/admin/system/inquiries` | `people/inquiries` | Inbound contact-form messages | People | `/admin/people/inquiries` | Inquiries are people-side |
| `/admin/system/features` | `system/features` | Feature flag toggles | System | `/admin/system/features` | No change |
| `/admin/system/mcp` | `system/mcp` | MCP tokens + tools | System | `/admin/system/mcp` | No change |
| `/admin/system/analytics-filters` | `analytics/filters` | Analytics filter rules | Analytics | `/admin/analytics/filters` | |
| `/admin/system/agent` | `system/agent` | AI agent console | System | `/admin/system/agent` | No change |
| `/admin/system/errors` | `system/errors` | Error log | System | `/admin/system/errors` | No change |
| `/admin/system/info` | `system/diagnostics` | Diagnostics | System | `/admin/system/diagnostics` | Renamed from `info` for clarity |
| `/admin/system/performance` | `system/performance` | Perf beacons | System | `/admin/system/performance` | No change |
| `/admin/system/account-settings` | `site/account-settings` | Customer account UX config | Site | `/admin/site/account-settings` | Controls customer-side chrome |
| `/admin/system/auth` | `people/auth` | Auth diagnostics + lockouts | People | `/admin/people/auth` | |
| `/admin/system/backups` | `system/backups` | Backup runs | System | `/admin/system/backups` | No change |
| `/admin/system/compliance` | `site/compliance` | GDPR / cookie consent toggles | Site | `/admin/site/compliance` | Operator-facing site config |
| `/admin/system/permissions` | `people/permissions` | Permission grants matrix | People | `/admin/people/permissions` | |
| `/admin/system/redirects` | `site/redirects` | URL redirects | Site | `/admin/site/redirects` | |
| `/admin/system/seo` | `analytics/seo` | SEO health overview | Analytics | `/admin/analytics/seo` | SEO split: defaults at `/admin/site/seo`, overview here |
| `/admin/marketing/attribution` | `analytics/attribution` | Marketing attribution | Analytics | `/admin/analytics/attribution` | "Marketing" bucket dropped; folds into Analytics |
| `/admin/onboarding` | `onboarding` | First-run wizard | (top-level) | `/admin/onboarding` | No change — wizard is its own surface |

**Total panes**: 46 (44 registered loaders + 2 legacy/standalone views).

## SEO double-home — design choice

Two SEO panes, two homes:

- **`/admin/site/seo`** — *SEO defaults config*. Operator setting up
  per-page title templates, OG defaults, robots policy. Configuration.
- **`/admin/analytics/seo`** — *SEO health overview*. Operator checking
  whether pages are indexable, sitemap fresh, schema valid. Insight.

Operators think about these two flows differently. Two surfaces, two
homes.

## Demo content — folded under System

`cars` (and future `things-to-do` if it lands as a pane) live under
`/admin/system/demo-content/*` so they don't clutter the main Content
flow. Operator actively uses cars demo seed, so they're not dropped —
just grouped.

## Top-bar buttons (operator-visible chrome)

Six buttons in the admin top bar, in this left-to-right order:

1. **Site** — site config
2. **Content** — pages, posts, releases
3. **Commerce** — products, orders, invoices
4. **People** — users, customers, inquiries
5. **Analytics** — dashboard, SEO health, audit log
6. **System** — dev / power-user knobs (advanced-mode only)

## Follow-up sweep — per-area work

This jump's Commit 1 adopted the new shared components in six
demonstrator panes (one per bucket). The remaining ~40 panes still
render hand-rolled headers / empty states / save rows. Per-area sweep
agents pick up from here:

| Bucket | Demonstrator (commit 1) | Remaining panes to sweep |
|---|---|---|
| Site | Footer | Themes, Logo, Layout, SEO defaults, Email config, Email templates, Compliance, Redirects, Languages, Account settings |
| Content | SystemPagesPanel | AdminApp (pages tree), Posts, Translations, Publishing, Releases, Trash |
| Commerce | InvoicesListPane | Products, Inventory, Orders, Settings, Abandoned cart, Checkout, Warehouse sync, Product templates |
| People | Users | Permissions, Inquiries, Auth |
| Analytics | AnalyticsPanel | Audit log, Attribution, SEO overview, Analytics filters |
| System | Diagnostics | MCP, Features, Errors, Agent, Performance, Backups, Bundle, Modules preview, Demo content (cars) |

Each pane swaps its hand-rolled chrome for `<PaneHeader>` /
`<EmptyState>` / `<SaveBar>` from `ui/admin/shell/`. Mechanical
change; one PR per area is the suggested unit.

## Legacy redirect shim

Old URLs 301 to their new home via `ui/client/next.config.js`
`redirects()`. The shim ships for one release cycle (~2 months) and is
then dropped — anyone still hitting an old URL gets a 404 and updates
their bookmark.

**Scope note (2026-05-16):** the IA jump landed redirects only for the
demonstrator panes whose loaders + App Router page directories
actually moved (Footer, Users, Analytics dashboard, Diagnostics). The
remaining buckets' redirects land alongside their per-area sweep —
adding a redirect before the destination directory exists 404s the
operator.

Currently-redirected legacy URLs:

| Old URL | New URL |
|---|---|
| `/admin/content/footer` | `/admin/site/footer` |
| `/admin/system/users` | `/admin/people/users` |
| `/admin/seo/analytics` | `/admin/analytics` |
| `/admin/system/info` | `/admin/system/diagnostics` |

(Pre-existing redirects from earlier segregation jumps — `/admin/settings`,
`/admin/languages`, `/admin/modules-preview` — remain in place.)

The other 28 rows in the table above are aspirational URLs that land
when their bucket's per-area sweep ships.
