# Features

Per-feature specifications, grouped into four tracks. Each spec is the source of truth for its module — what it does, where the code lives, what the open questions are.

## Tracks

| Track | What's in it | Folder |
|---|---|---|
| **Core** | The CMS that ships in a fresh install — content, themes, i18n, publishing, blog, admin experience, admin auth, fonts. Stable. | [`core/`](core/) |
| **E-commerce** | Optional commerce stack: customer accounts, products, cart, checkout, warehouse sync. Ships uncommitted on `develop`. Cleanly separable for a content-only fork. | [`ecommerce/`](ecommerce/) |
| **Tooling** | AI / quality concerns — MCP server for AI clients, end-to-end testing infrastructure. Cross-cuts every other track but isn't user-facing. | [`tooling/`](tooling/) |
| **Platform** | Cross-cutting refactors to the architecture itself — module manifests, codegen registry, feature toggles, edit scopes, admin UI modes. Pre-implementation. | [`platform/`](platform/) |

## Core (shipped)

| Feature | File | Summary |
|---|---|---|
| Content management | [core/content-management.md](core/content-management.md) | Sections, 17+ module types, drag-and-drop, image management |
| Theming | [core/theming.md](core/theming.md) | Theme presets, live previews, CSS-token cascade |
| Internationalization | [core/internationalization.md](core/internationalization.md) | Multilingual content, admin language, inline editing, CSV editor |
| Publishing | [core/publishing.md](core/publishing.md) | Snapshots, rollback, bundle export/import |
| Blog | [core/blog.md](core/blog.md) | Posts, drafts, blog feed module |
| Admin experience | [core/admin-experience.md](core/admin-experience.md) | Audit log, conflict detection, presence, roles |
| Authentication | [core/authentication.md](core/authentication.md) | Admin login, roles, first-boot password |
| Google Fonts | [core/google-fonts.md](core/google-fonts.md) | Font picker, GDPR self-hosting proxy |

## E-commerce (shipped 2026-04-29, uncommitted)

| Feature | File | Status |
|---|---|---|
| Customer authentication | [ecommerce/customer-auth.md](ecommerce/customer-auth.md) | Credentials + Google for customers; `kind` discriminator on `Users`; parallel customer-authz tables |
| Products | [ecommerce/products.md](ecommerce/products.md) | `Products` collection mirroring `Posts` shape; admin CRUD; public `/products` + `/products/[slug]` with ISR |
| Cart / Basket | [ecommerce/cart.md](ecommerce/cart.md) | Redis guest cart + Mongo customer cart, merge on sign-in; price snapshot at add-time, hard re-validate at checkout |
| Inventory / Warehouse | [ecommerce/inventory-warehouse.md](ecommerce/inventory-warehouse.md) | Pluggable adapter (`MockAdapter` + `GenericFeedAdapter`); per-field manual override locks; admin sync panel |
| Checkout | [ecommerce/checkout.md](ecommerce/checkout.md) | Multi-step flow; `Orders` state machine; `MockPaymentProvider` (Stripe slot-in via env); reservation-on-draft + 30-min sweep |

## Tooling

| Feature | File | Status |
|---|---|---|
| CMS AI Bridge (CLI + MCP) | [tooling/mcp-server.md](tooling/mcp-server.md) | **Spec replaced 2026-04-29** — current code is from prior MCP-token-server design. CLI-first redesign documented |
| End-to-end testing | [tooling/e2e-testing.md](tooling/e2e-testing.md) | **Phase 1 shipped** — Playwright config + fixtures + 3 specs + CI; Phases 2–4 queued |

## Platform (planned)

| Feature | File | Status |
|---|---|---|
| Service-side modularity | [platform/service-modularity.md](platform/service-modularity.md) | `feature.manifest.ts` per folder; deleting a feature folder keeps the build green. Underpins plug-and-play |
| Feature registry codegen | [platform/feature-registry-codegen.md](platform/feature-registry-codegen.md) | Build-time codegen of explicit static imports so WebStorm "Find Usages" walks through the registry. Pairs with service-modularity |
| Plug-and-play feature toggles | [platform/plug-and-play-features.md](platform/plug-and-play-features.md) | Runtime enable/disable per module, gated GraphQL + UI + routes |
| Multi-level edit granularity | [platform/edit-levels.md](platform/edit-levels.md) | Page / module / element scopes layered on top of role rank |
| Simplified vs advanced admin UI | [platform/admin-ui-modes.md](platform/admin-ui-modes.md) | Per-user mode, per-feature simplified/advanced views, mandatory-action panel |
| Admin segregation (6 concerns) | [platform/admin-segregation.md](platform/admin-segregation.md) | Collapse 17+ tabs into Build / Client config / Content / SEO / Release / System areas |

## Cross-references

Specs reference each other by relative path (`../<bucket>/<file>.md`). Architecture docs that any spec leans on (data model, auth roles, request lifecycle, test-id convention) live one level up at [`../architecture/`](../architecture/).
