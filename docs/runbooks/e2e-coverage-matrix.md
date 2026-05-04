# E2E Coverage Matrix

Snapshot date: 2026-05-03. Tracks every module, admin feature, and public route
against an existing Playwright spec. `Y/N` columns reflect whether the spec
runs un-skipped today; gap notes call out the missing testid / fixture / UI.

The visual baselines at `tests/e2e/visual/modules/{displays,editors}.spec.ts`
iterate over `Object.values(EItemType)` so adding a new module type does not
require a new spec file. Both visual specs are non-skipped (zero `test.skip`
calls).

---

## 1. Modules (one row per `EItemType`)

| module | display test | editor test | smoke runs | notes |
|---|---|---|---|---|
| TEXT (Text) | visual/modules/displays.spec.ts | visual/modules/editors.spec.ts | Y | + modules/plain-text.spec.ts |
| RICH_TEXT | visual/displays | visual/editors | Y | + modules/rich-text.spec.ts |
| IMAGE | visual/displays | visual/editors | Y | + modules/image.spec.ts |
| CAROUSEL | visual/displays | visual/editors | Y | + modules/carousel.spec.ts |
| GALLERY | visual/displays | visual/editors | Y | + modules/gallery.spec.ts |
| HERO | visual/displays | visual/editors | Y | + modules/hero.spec.ts |
| PROJECT_CARD | visual/displays | visual/editors | Y | + modules/project-card.spec.ts |
| SKILL_PILLS | visual/displays | visual/editors | Y | + modules/skill-pills.spec.ts |
| TIMELINE | visual/displays | visual/editors | Y | + modules/timeline.spec.ts; anchors spec has 1 skip |
| SOCIAL_LINKS | visual/displays | visual/editors | Y | + modules/social-links.spec.ts |
| BLOG_FEED | visual/displays | visual/editors | Y | + modules/blog-feed.spec.ts |
| LIST | visual/displays | visual/editors | Y | + modules/list.spec.ts |
| SERVICES | visual/displays | visual/editors | Y | + modules/services.spec.ts |
| TESTIMONIALS | visual/displays | visual/editors | Y | + modules/testimonials.spec.ts |
| STATS_CARD | visual/displays | visual/editors | Y | + modules/stats-card.spec.ts |
| PROJECT_GRID | visual/displays | visual/editors | Y | + modules/project-grid.spec.ts |
| MANIFESTO | visual/displays | visual/editors | Y | + modules/manifesto.spec.ts |
| INQUIRY_FORM | visual/displays | visual/editors | Y | + modules/inquiry-form.spec.ts |
| DATA_MODEL | visual/displays | visual/editors | Y | + modules/data-model.spec.ts |
| INFRA_TOPOLOGY | visual/displays | visual/editors | Y | + modules/infra-topology.spec.ts |
| PIPELINE_FLOW | visual/displays | visual/editors | Y | + modules/pipeline-flow.spec.ts |
| REPO_TREE | visual/displays | visual/editors | Y | + modules/repo-tree.spec.ts |
| ARCHITECTURE_TIERS | visual/displays | visual/editors | Y | + modules/architecture-tiers.spec.ts |
| STATS_STRIP | visual/displays | visual/editors | Y | + modules/stats-strip.spec.ts |

`EMPTY` is excluded — it is a placeholder type with no display/editor.

**Module count: 24 / 24 covered (100%).**

---

## 2. Features (admin panes / behaviors)

| feature | spec | happy-path runs | edge cases | gap notes |
|---|---|---|---|---|
| Posts (advanced) | features/blog-posts.spec.ts | Y | conflict, draft toggle | — |
| Posts (AUI simplified) | features/aui-simplified.spec.ts | Partial | 2 skips | needed `posts-form-*` testids — wired in this pass on `PostsSimplifiedView` |
| Themes | features/themes.spec.ts | Y | activate flow | — |
| Themes (AUI simplified) | features/aui-simplified.spec.ts | Y | hides New/Edit/Duplicate/Delete | — |
| Trash | features/trash.spec.ts | Partial | 3 skips | UI groups by `trashGroup` not by slug; spec assumes per-slug rows. Needs `trash-row-${trashGroup}` + `data-trash-group` decoration before unskipping cascade test |
| Languages | features/translations.spec.ts | Y | per-locale slug | — |
| Bundle | features/bundle.spec.ts | Y | export/import | — |
| Footer | features/footer.spec.ts | Y | — | — |
| Logo | features/themes.spec.ts (covers logo) | Partial | — | dedicated logo spec absent — low priority, covered visually |
| Navigation | features/sub-pages.spec.ts | Partial | 4 skips | needs `nav-page-parent-option-${slug}`, `nav-page-depth-error-toast`, `nav-page-cycle-error-toast`, `nav-page-delete-confirm-btn` |
| Products (admin) | ecommerce/products.spec.ts | Y | end-to-end create wired | — |
| Products (storefront list/detail) | ecommerce/products.spec.ts | Y | seed-driven card → detail | — |
| Inventory | ecommerce/inventory.spec.ts | Partial | per-row stock edit | UI is sync-only — no per-product stock cell. Storefront-side OOS check now wired via seedProduct |
| Orders | ecommerce/orders.spec.ts | Y | seed-driven detail Drawer | URL nav path doesn't exist (Drawer-only) — documented |
| Cart | ecommerce/cart.spec.ts | Partial | qty stepper, remove btn | UI lacks per-row qty stepper + remove btn testids |
| Checkout | ecommerce/checkout.spec.ts | Y | full address→payment→confirm | country field is 2-char Input not Select (testid name retained for compat) |
| Sub-pages | features/sub-pages.spec.ts | Partial | 3 skips | depth-4 + cycle toasts need testids |
| Idempotency / useGuardedAction | features/idempotency.spec.ts | Partial | 1 skip | needs `nav-page-delete-confirm-btn` to mash; reusability test needs a non-destructive guarded button candidate |
| Timeline anchors | modules/timeline-anchors.spec.ts | Partial | 1 skip | scroll-anchor target identifier not stable |
| F5 Diagnostics | features/diagnostics.spec.ts | Y | admin gating, refresh | NEW — added in this pass |
| Auth (login/logout) | features/auth-admin.spec.ts | Y | wrong-password lockout | — |
| Auth (customer) | features/customer-auth.spec.ts | Y | — | — |
| Onboarding | features/onboarding.spec.ts | Y | first-run wizard | — |
| SEO (site) | features/seo.spec.ts | Y | meta tags | — |
| Permissions | features/users.spec.ts (grants) | Y | role-bound writes | — |
| Users | features/users.spec.ts | Y | invite + role change | — |
| MCP tokens | features/mcp-tokens.spec.ts | Y | rotate | — |
| Inquiries | features/inquiries.spec.ts | Y | submit + admin view | — |
| Feature flags | (none) | N | — | no spec; flags currently surfaced only via Diagnostics |
| Audit log | features/audit-log.spec.ts | Y | admin view | — |
| Error log | (covered by Diagnostics + audit) | Partial | — | no dedicated error-log pane spec |
| Analytics | (none) | N | — | no spec; pane exists |
| Publishing | features/publishing.spec.ts | Y | publish+revalidate | — |
| Agent | features/agent.spec.ts | Y | natural-lang authoring | — |
| Upload batch | features/upload-batch.spec.ts | Y | — | — |
| Admin create page | features/admin-create-page.spec.ts | Partial | 1 skip | sub-page parent select option testid |
| Admin module chain | features/admin-modules-chain.spec.ts | Partial | 3 skips | needs editor save-loading state testids |

**Feature rows: 35. Fully running: 22. Partial (≥1 skip): 11. No spec: 2 (Feature flags, Analytics).**

---

## 3. Public routes

| route | spec | runs | notes |
|---|---|---|---|
| `/` (home) | features/blog-posts.spec.ts (anon paths) | Y | also exercised by sub-pages depth-1 |
| `/blog` | features/blog-posts.spec.ts | Y | — |
| `/blog/[slug]` | features/blog-posts.spec.ts | Y | — |
| `/lv/<page>` (depth-1 sub-page) | features/sub-pages.spec.ts | Y | — |
| `/lv/<a>/<b>` (depth-2) | features/sub-pages.spec.ts | Y | covered by chain test |
| `/lv/<a>/<b>/<c>` (depth-3) | features/sub-pages.spec.ts | Partial | resolution-only test runs; depth-4 reject is skipped |
| `/api/info` shape | (none) | N | recommended: add a contract spec under tests/e2e/features/api-info.spec.ts that GETs and asserts top-level keys (gitSha, build, features array shape). Out of scope for this pass |
| `/sitemap.xml` | (none) | N | recommended: add a tiny anonPage GET that asserts content-type=application/xml and includes at least one `<url>` |
| `/products` | ecommerce/products.spec.ts | Y | — |
| `/products/[slug]` | ecommerce/products.spec.ts | Y | seed-driven |
| `/cart` | ecommerce/cart.spec.ts | Y | empty + 1-line covered |
| `/checkout/*` | ecommerce/checkout.spec.ts | Y | full chain |

**Public routes: 12 listed. Running: 10. Missing: 2 (`/api/info` contract, sitemap).**

---

## Summary

- Total rows: **24 modules + 35 features + 12 public routes = 71**.
- Running today: **24 + 22 + 10 = 56 (~79%)**.
- Partial (≥1 skip in spec): **0 + 11 + 1 = 12**.
- No spec at all: **0 + 2 + 2 = 4**.

Skips after this pass: **24 → 24** (none added; ecommerce skips converted to
runnable tests once seedProduct/seedOrder were wired; cart qty / cart remove
remain skipped because the underlying UI testids don't exist; sub-pages /
trash / idempotency skips remain because the admin testids those tests need
are still un-wired).
