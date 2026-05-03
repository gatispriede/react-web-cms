# F1 — sub-pages (nested page hierarchy)

## Goal

Extend the single-level page nav to allow nested children. A page can have a parent; rendered as `/parent/child` on the public site, surfaced under the parent in the admin sider, and addressable everywhere a single page is today (link picker, navigation menu, breadcrumb, sitemap, ISR revalidate).

Out of scope for v1: arbitrary depth (lock to 2 levels — root + one child level). 3+ levels can land later as a separate item once the v1 contract is proven in production.

## Why now

- Customer feedback (2026-05-03): the top-bar nav is flat. Sites with 10+ pages need grouping ("About", "Services", "Contact" → top; sub-items underneath).
- The single-level model couples nav structure to URL structure and to sider hierarchy. Decoupling is overdue.

## Design

### Data model

Extend `IPage` and `INavigation` with a `parent?: string` field — value is the parent page's `id` (not its slug, so parent renames don't break references).

```typescript
// shared/types/IPage.ts
export interface IPage {
  page: string;              // unchanged — display name
  parent?: string;           // NEW — parent INavigation.id, undefined = root
  seo: ISeo;
  sections: string[];
}

// shared/types/INavigation.ts
export interface INavigation {
  id: string;
  type: string;
  page: string;
  parent?: string;           // NEW — same field
  seo: ISeo | undefined;
  sections: string[];
}
```

Mongo migration: zero-downtime — `parent` is optional. Existing rows have `parent` undefined, treated as root pages. No backfill needed.

### URL routing

Today: `/[lang]/[slug]` matches one segment. With sub-pages, the public route becomes `/[lang]/[...slug]` (catch-all) so `/lv/services/cleaning` resolves to the page whose slug-chain matches. The page lookup walks the `parent` chain to assemble the URL:

```typescript
// Resolve `/lv/services/cleaning` → find page where slug='cleaning'
// AND parent's slug='services' AND that parent has no parent (top-level).
function resolveBySlugChain(chain: string[]): IPage | null
```

Slug uniqueness: enforced **within a parent scope**, not globally. Two children under different parents can share a slug (e.g. `/services/contact` and `/about/contact`).

### Admin sider

`AdminApp` already lists pages flat. Sub-pages render as nested rows under their parent, with a chevron expand/collapse. The existing `nav-page-row-<slug>` test ID stays but new sub-pages get `nav-page-row-<parent>-<slug>` so e2e specs can target them deterministically.

Add-page dialog gains an optional "Parent page" Select (defaults to "(top level)").

### Anchor registry + link picker

`anchorRegistry.ts` walks pages and emits `/${slug}` per page. Update to walk the parent chain and emit the full `/parent/child` href. Picker labels show indented paths: `Services → Cleaning` instead of just `Cleaning`.

### Navigation feature (public-side menu)

The site's nav menu (top bar / mobile drawer) currently lists every root page. Sub-pages render as a dropdown / expandable group under the parent. The Navigation feature gains a `renderNested: boolean` siteFlag — `true` (default) shows the dropdown, `false` keeps the flat list (sub-pages still reachable via direct URL).

### Breadcrumbs

New `<Breadcrumb>` component on every public page that has `parent !== undefined`. Walks the chain, renders `Home / Services / Cleaning`. Hidden on root pages.

### SEO

`/parent/child` gets its own `<title>` / OG tags from the child page's `seo` field. Sitemap includes the full URL path. Open Graph uses the child's image; falls back to parent's; falls back to site default.

### ISR + cache

C9 cache-tag header includes both the parent and the child feature versions when a sub-page is rendered, so invalidating either parent or child evicts the cached entry.

### Backwards compat

- Saved JSON for existing pages doesn't change — `parent` defaults to undefined.
- Existing single-segment URLs (`/lv/about`) keep working through the catch-all (`[...slug]` matches single-segment too).
- Existing link picker hrefs (`/about`) keep resolving — the resolver checks for top-level slug match first.

## Files to touch

- `shared/types/IPage.ts`, `shared/types/INavigation.ts` — add `parent?: string`
- `services/api/schema.graphql` — add `parent` to `IPage` / `INavigation` types + mutation args
- `services/features/Navigation/NavigationService.ts` — `parent` in queries / writes
- `services/features/Navigation/NavigationServiceLoader.ts` — manifest update
- `ui/client/pages/[lang]/[...slug].tsx` — RENAME from `[slug].tsx`; resolve by chain
- `ui/client/features/Navigation/` — sub-page-aware menu renderer
- New `ui/client/features/Navigation/Breadcrumb.tsx`
- `ui/admin/shell/AdminApp.tsx` — sider nested rendering
- `ui/admin/features/Dialogs/AddNewDialogNavigation.tsx` — add Parent Select
- `ui/admin/lib/anchorRegistry.ts` — walk chain, emit nested hrefs + indented labels
- `ui/admin/lib/LinkTargetPicker.tsx` — render indented paths
- `ui/client/features/Themes/Theme.tsx` (sitemap path generator if it lives there)
- `ui/client/pages/api/sitemap-*.xml.ts` — emit nested URLs
- `tests/e2e/features/sub-pages.spec.ts` (new) — happy-path: create root, create child, navigate via direct URL, navigate via picker-emitted href, breadcrumb renders

## Acceptance

- [ ] Admin can create a page with a parent; sider shows it nested under the parent
- [ ] Public URL `/lv/services/cleaning` renders the child; `/lv/services` renders the parent (independent content)
- [ ] Two children under different parents can share a slug without collision
- [ ] Link picker renders indented labels (`Services → Cleaning`); selecting one writes the full path
- [ ] Existing single-segment URLs still work
- [ ] Renaming the parent updates the public URL of all children automatically (id-based parent reference)
- [ ] Deleting a parent prompts: orphan children become root, OR delete cascade. Pick one (recommend: prompt + default to orphan)
- [ ] Sitemap includes nested URLs
- [ ] Breadcrumb renders on child pages, hides on root
- [ ] No content schema migration required

## Decisions (resolved 2026-05-03)

1. **Slug source of truth** — explicit `slug: string` field on `IPage`. Defaults to slugified `page` on first save; never auto-updates on rename. A separate "Change slug" action triggers an explicit redirect-old → new shim.
   - **Per-locale slugs (open follow-up)** — multilingual sites likely need a localized slug per language (`/lv/par-mums` ≠ `/en/about-us`). Field shape would evolve from `slug: string` to `slug: string | Record<LocaleCode, string>`, with the bare-string form treated as `{[defaultLocale]: slug}` for back-compat. Per-locale fallback rule: missing locale falls through to the default-locale slug. Catch-all router walks the slug-chain in the request locale first, then default. Decide at implementation time whether to ship per-locale slugs in v1 or defer to v2 once the basic sub-page model is stable; the data shape upgrade is non-breaking either way.
2. **Cycle prevention** — both sides. Server-side rejection in `NavigationService` is the source of truth (covers MCP / API callers). Admin UI also disables invalid parent options in the Select for UX.
3. **Move-with-children** — subtree relocates together. No split option; detaching a child is an explicit per-child parent change.
4. **Depth cap** — max 3 levels (root + 2 child levels). Server enforces in the same `setParent` validation as cycle prevention.
5. **Public nav rendering** — dropdown. Standard visual convention; per-theme override is a follow-up if requested.
6. **Nav primitive** — AntD `<Menu mode="horizontal">` with `SubMenu` for nested children. Replaces the hand-rolled tablist. Per-theme styling (CSS custom properties / theme-scoped SCSS) is in scope from day one — not a follow-up — so the existing themes don't visually regress on the swap.

## Effort

- Data model + GraphQL: **S** (1-3 h)
- Public route resolver + `[...slug]` catch-all: **S** (2-3 h)
- Admin sider nested render + Add Parent Select: **S** (2-3 h)
- Anchor registry + link picker labels: **S** (1-2 h)
- Public nav dropdown + breadcrumb: **S** (2-3 h)
- Sitemap + ISR cache: **S** (1-2 h)
- E2E spec + edge cases (cycles, slug collisions, rename, delete-with-children): **M** (3-4 h)

**Total: L (1-3 days)**, weighted toward edge-case validation.

## Dependency notes

- Builds on C13 (link picker) — picker UI already exists; just needs label-walking.
- Builds on C9 (cache versioning) — sub-page invalidation reuses the same `cacheVersionKeys` machinery.
- Doesn't touch Q10 (grants) — but a per-page grant on a parent doesn't auto-cascade to children. v1 keeps grants per-row; cascading is a follow-up if/when it becomes a complaint.

## Risk

- The catch-all route `/[...slug]` overlaps the existing `/[slug]` route. Must rename `[slug].tsx` → `[...slug].tsx` atomically; the routing table doesn't allow both.
- `parent` references survive the parent's deletion as orphans. Must surface "parent missing" cleanly in admin (greyed nav row).
- Rename of a parent's slug breaks bookmarked child URLs. Consider emitting a 308 redirect from the old path during a grace period (similar to Q5 admin-segregation Phase 3 model).
