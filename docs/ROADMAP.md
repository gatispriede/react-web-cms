# Roadmap — redis-node-js-cloud CMS

Forward-looking only. Architecture: [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) + the UML at [architecture/data-model.svg](architecture/data-model.svg). Per-item plans + estimates: [`roadmap/`](roadmap/).

---

## Queued

### E-commerce wiring

E-commerce specs ([`docs/features/ecommerce/`](features/ecommerce/)) and the supporting UI / services landed 2026-04-29. Real authoring + flow is blocked on **#1 (ProductApi mock → real resolvers)** below; until that flips, `/products`, `/cart`, `/checkout` render empty states and the e-commerce e2e specs are surface-mount only. Wiring order once #1 lands: customer-auth (done) → products (#1) → cart → inventory → checkout.

### Platform refactors

These are cross-cutting; land *after* the e-commerce wiring stabilises.

1. [features/platform/plug-and-play-features.md](features/platform/plug-and-play-features.md) — first-class feature toggles per module (products, cart, checkout, inventory, blog, MCP, customer auth). Disabled features hide their admin tab, 404 their public routes, and refuse their GraphQL operations. Defaults: CMS-core on, e-commerce + MCP off until the operator opts in.
2. [features/platform/edit-levels.md](features/platform/edit-levels.md) — page-level / module-level / element-level edit grants on top of the existing role rank. New `Permissions` collection joining user → resource → scope; `guardMethods` adds a per-resource check after the role check.
3. [features/platform/admin-ui-modes.md](features/platform/admin-ui-modes.md) — simplified vs advanced admin UI modes. Per-user setting with site-wide default. Each feature pane declares its own `AdminPaneDescriptor`; the shell never branches on mode. Includes a "Things to do" first-run panel.
4. [features/platform/service-modularity.md](features/platform/service-modularity.md) — make `services/features/<X>/` self-contained: each folder owns its services, GraphQL SDL, resolvers, authz contributions, indexes via `feature.manifest.ts`. Visible artefact: deleting a feature folder keeps the build green. Underpins #1 (plug-and-play). Smallest-first migration: Audit → Cart → Products → Inventory → Orders → Mcp → Customer auth → Core.
5. [features/platform/feature-registry-codegen.md](features/platform/feature-registry-codegen.md) — discovery for #4's manifests. Build-time codegen of explicit static imports so IDE "Find Usages" still walks the call graph. `tools/codegen-feature-registry.ts` writes `services/infra/featureRegistry.generated.ts`; `predev` + `prebuild` regen; CI runs `:check` to fail on staleness. Lands with #4.

### E2E backlog

Explicit `test.fixme` markers in the suite. Order by leverage:

6. **ProductApi mock → real resolvers** — `services/api/client/ProductApi.ts` is a stub because `getProducts` / `saveProduct` / `searchProducts` / `setProductPublished` aren't on the GraphQL schema. Implement the resolvers (mirror `PostService` shape) + regenerate gqty + drop the stub. Promotes 5 surface-mount specs (`products`, `cart`, `checkout`, `inventory`, `orders`) to real flow specs.
7. **Empty-array `defaultContent` fix** — 7 modules (`List`, `ProjectGrid`, `Services`, `SocialLinks`, `StatsCard`, `Testimonials`, `Timeline`) seed `defaultContent` with empty arrays, so the `(i === 0 ? testid)` placement never renders the canonical `module-editor-primary-text-input` until "Add" is clicked. Seed one row in `ui/admin/lib/itemTypes/registry.ts` defaultContent — also makes the editor less empty-feeling. Unblocks 14 fixme tests.
8. **gqty schema regeneration** — `npm run generate-schema` against a live server with the updated `services/api/schema.graphql` (which now includes `IUser.kind`). Drop the raw-fetch workaround in `services/api/client/UserApi.ts`. Probably also fixes the MCP `mcp-issue` / `mcp-revoke` flow (currently `fixme`). 2 fixme tests.
9. **Themes direct-route gqty** — `Theme.tsx` at `/admin/client-config/themes` gets empty `mongo.getThemes` from `gqty.resolve` even though raw `fetch('/api/graphql')` returns the seeded themes. Worked under the legacy tabbed shell. May resolve with #8; if not, needs its own gqty client-init investigation. Smoke step 7 + `themes.spec.ts` reinstate.
10. **BlogFeed `<Collapse>` testid** — move `module-editor-primary-text-input` out of the More-options collapse, OR have the harness expand the collapse before fill. 1 fixme test.
11. **Blog posts editor testids** — admin authoring at `/admin/content/posts` needs `posts-new-btn`, `posts-title-input`, `posts-slug-input`, `posts-save-btn` on `Posts.tsx`. 1 fixme test.
12. **Visual regression baselines** — curated set of public pages + `/admin/build/modules-preview` get screenshot baselines under `tests/e2e/visual/__snapshots__/`. Update via `npm run e2e:update-screenshots` (already scripted). CI sharding: 4× chromium, nightly on `master`.

### Admin UX — Phase 3 cleanup

13. [features/platform/admin-segregation.md](features/platform/admin-segregation.md) — drop the legacy `/admin/settings` tab strip + retire the `AdminSettings.tsx` shell. Phase 1 (additive routes) and Phase 2 (six-area top bar + jump routes) are shipped; Phase 3 is the legacy-removal sweep after one or two release cycles confirm nothing is bookmarked against the old URLs.

### Production caching

14. [production-caching.md](roadmap/production-caching.md) — ISR + on-demand revalidation + Caddy SWR + DataLoader **(L)**. ISR portion shipped 2026-04-30 as part of e2e #15; remaining work is Caddy stale-while-revalidate + DataLoader.

### Go-to-market

| Item | Status |
|---|---|
| Onboarding flow — first-run wizard (site name, admin account, theme pick) | Planned |
| Landing page — AI angle, positions against Contentful / Builder.io, pricing | Planned |
| Documentation — setup, feature reference, AI/MCP workflow guide | Planned |

### Production / ops

[`roadmap/production/`](roadmap/production/README.md) — feature/UX and ops scheduled independently.

| Item | Status |
|---|---|
| [Automatic deployment](roadmap/production/automatic-deployment.md) | Planned |
| [Seamless deployment (zero-downtime)](roadmap/production/seamless-deployment.md) | Planned |
| [DigitalOcean domain + TLS wiring](roadmap/production/digitalocean-domain-wiring.md) | Planned |
| [MongoDB auth](roadmap/production/mongodb-auth.md) | Planned |

---

## Debt

All known debt cleared. See git log for the fixes:
- ~~GQty client edits~~ — regenerated cleanly; introspection covers every previously hand-patched field.
- ~~sanitizeKey regex v2~~ — v1 dropped; correct regex + collision-safe hash suffix for long inputs.
- ~~Ghost Navigation docs~~ — root cause fixed; boot-time warning + idempotent cleanup script for legacy databases.
- ~~`react-drag-reorder` dependency~~ — dropped.
- ~~Dead-dep / peer-conflict cleanup~~ — `npm install` runs clean without `--legacy-peer-deps`.
