# App Router migration

> **STATUS: Batch 1 of N shipped — 2026-05-14.** Foundation + static leaf
> pages are live on the App Router; the rest of `pages/` is untouched and
> still served by the Pages Router (Next runs both concurrently). This is
> an XL item being delivered in batches — see
> [Batch 1 shipped](#batch-1-shipped-2026-05-14) and
> [Remaining batches](#remaining-batches) below. NOT struck from
> `README.md` — the item is not fully done.
>
> **Batch 1.5 — RSC boundary cleanup (2026-05-16).** Three build-blocking
> RSC violations surfaced when `/admin` and error/404 chains first ran
> against the App Router root layout: `refreshBus.ts` mixed a React hook
> with a non-React class (server-reachable via `MongoApi` → `authOptions`
> → `layout.tsx`), `Logo.tsx` class component pulled into `not-found.tsx`
> chain unmarked, and `app/i18n.ts` co-located `initServerI18next` (uses
> `fs/promises`) with constants the client `providers.tsx` imported.
> Fixes: split `useRefreshView.ts` out + `Logo`/`ImageUpload` `"use client"`
> + `i18nConfig.ts` pure-data module. Direct prerequisite for B2 — without
> these every error/404 render under app-router fails to compile. See
> [shipped.md 2026-05-16 RSC boundary cleanup](../shipped.md).

Migrate `ui/client/pages/` → `ui/client/app/`. Pages router → App router.

API routes (`ui/client/pages/api/*`) **stay where they are** — Next supports
both routers concurrently. That alone trims ~12 files out of scope and lets
us keep `next-auth@4` instead of jumping to v5.

`next-i18next` is already on `^16.0.5`; the existing pages-router app uses
the `next-i18next/pages` and `next-i18next/pages/serverSideTranslations`
subpath imports and works. v16 also exposes `next-i18next/server` and
`next-i18next/client` for the new app-router surface.

## Batch 1 shipped (2026-05-14)

Established the App-Router foundation **without** migrating any risky
dynamic / auth / data-loading pages. Next serves the new `app/*` routes
and the remaining `pages/*` routes concurrently — verified no route
collisions (the migrated Pages-Router files were deleted in the same
change, since `app/privacy` + `pages/privacy` both existing is a hard
Next error).

**Created — `ui/client/app/`:**
- `app/layout.tsx` — root layout (Server Component). The App-Router
  equivalent of `_app.tsx` + `_document.tsx` merged:
  - Hoists ALL global SCSS imports (`global.scss`,
    `Marketing/landing.scss`, admin dark-mode, inline-edit overlay,
    command palette, + the full per-module SCSS list) — App Router only
    allows global CSS from the root layout. `pages/_app.tsx` keeps its
    own copy for the still-Pages-Router pages.
  - `resolveRequestLocale()` — ports `_app.tsx`'s `universalLanguageDetect`
    chain via `cookies()` (`i18next` cookie) → `headers()`
    (`Accept-Language`) → `FALLBACK_LNG`.
  - Resolves active theme tokens + `selfHostFonts` flag via
    `getMongoConnection()`, builds the DB-driven Google Fonts URL
    (`buildGoogleFontsUrl`), renders `<html lang>`, `<body data-theme-name>`,
    `<style data-theme-vars>`, favicon + fonts `<link>`s — direct port of
    `_document.tsx` `getInitialProps`.
  - `export const dynamic = 'force-dynamic'` — safe Batch-1 default for
    the DB-driven fonts URL (risk-map #3); `revalidate` + `revalidateTag('theme')`
    tuning deferred to the dynamic-pages batch.
  - Server-resolves the NextAuth session (`getServerSession(authOptions)`)
    and hands it to `<Providers>` so `useSession()` doesn't flicker
    (risk-map #9).
  - Drops the dead `global.preloadedData` inline `<script>` (risk-map #14).
- `app/providers.tsx` (`'use client'`) — provider stack ported from
  `_app.tsx` `render()`: `<AntdRegistry>` (replaces `_document.tsx`
  cssinjs `StyleProvider`/`extractStyle` — risk-map #1) → `<SessionProvider>`
  (seeded) → `<I18nProvider>` (replaces `appWithTranslation`) →
  `<ConfigProvider>` (antd static theme). Side-effect hosts
  (`InlineTranslationHost`, `HighContrastAutoPick`, `PresenceHost`,
  `AnalyticsHost`, `SignupBanner`, `CookieConsent`, `CartDrawer`,
  `SkipLink`) mounted as `children` siblings.
- `app/ClientRuntimeHost.tsx` (`'use client'`) — ports `_app.tsx`'s
  `componentDidMount` (service-worker unregister, error reporter, perf
  beacon, marketing capture).
- `app/i18n.ts` — owns the single `initServerI18next()` call; runs in
  **no-locale-path mode** (`localeInPath: false`) so the migrated routes
  aren't locale-prefixed and share the `i18next` cookie with the
  Pages-Router pages.
- `app/not-found.tsx` ← `pages/404.tsx`. Server Component; `getT` from
  `next-i18next/server`.
- `app/error.tsx` (`'use client'`) ← runtime-error half of `pages/_error.tsx`.
  Route-level error boundary; `useT` from `next-i18next/client`; reports
  to the server error pipe.
- `app/global-error.tsx` (`'use client'`) ← hard-SSR-500 half of
  `pages/500.tsx` / `_error.tsx`. Renders its own `<html>`/`<body>`
  (sits above the root layout); static English copy (no provider in
  scope).
- `app/privacy/page.tsx` ← `pages/privacy.tsx` (no data deps; mechanical).
- `app/terms/page.tsx` ← `pages/terms.tsx` (no data deps; mechanical).

**Deleted — Pages Router (only the migrated files):**
`pages/privacy.tsx`, `pages/terms.tsx`, `pages/404.tsx`, `pages/500.tsx`,
`pages/_error.tsx`.

**Deliberately NOT touched:** `pages/_app.tsx`, `pages/_document.tsx`
(the remaining Pages-Router pages still need them), every other
`pages/*` route, all of `pages/api/*`, `ui/admin/*`,
`ui/client/modules/*`, `services/*`.

**Verification:** `npx tsc -p ui/client/tsconfig.json --noEmit` — all
`app/*` files typecheck-clean. The only remaining errors are pre-existing
in `ui/client/modules/clientItemTypes.ts` (out of Batch-1 scope). A full
`next build` was not run as part of this batch (per the integration
directive — batch is typecheck-clean + structurally correct).

### Risk items addressed in Batch 1

- **#1 antd cssinjs SSR registry** — `<AntdRegistry>` in `providers.tsx`.
- **#2 `<body data-theme-name>`** — applied in `layout.tsx`.
- **#3 DB-driven Google Fonts URL** — `force-dynamic` chosen for Batch 1;
  `revalidateTag('theme')` optimisation documented as deferred.
- **#7 `_app.tsx` initial-props chain** — replaced by `cookies()` /
  `headers()` reads in `layout.tsx`.
- **#9 `SessionProvider` initial session** — server-resolved + seeded.
- **#10 `serverSideTranslations`** — replaced by v16 `getT` / `getResources`
  (server) + `<I18nProvider>` (client).
- **#14 dead `preloadedData`** — dropped, not ported.

### Still-open risks (later batches)

- **#4 `pages/api/revalidate.ts` `res.revalidate`** — still a no-op risk
  for App-Router routes; not yet touched (no App-Router page is
  revalidate-driven yet).
- **#5 `InlineTranslationEditor` global `reloadResources()`** — needs a
  cross-surface verification once an inline-editor consumer moves to
  App Router.
- **#6 `mongoDBConnection.seedIfEmpty()` static flag** — `adminSeeded`
  boolean NOT yet replaced with the `seedingPromise` singleton. The
  layout calls `getMongoConnection()` server-side; under App Router's
  parallel server-component model this is a live double-seed risk —
  **do this early in Batch 2.**

## Remaining batches

Tracked as a checklist; each batch lands as its own PR. Sizes are rough.

- [x] **Batch 2 — mongo re-entry guard + revalidate fix (S).** Shipped
  2026-05-16. `adminSeeded` boolean (in `UsersServiceLoader`, not
  `MongoDBConnection` as the spec originally guessed) + `ThemeService.seeded`
  static both replaced with `Promise<void> | null` singletons that null
  on failure for retry (risk #6). `pages/api/revalidate.ts` calls both
  `res.revalidate(p)` and `revalidatePath(p)` from `next/cache` per path
  — dual-mode so Pages-Router and App-Router routes both flush during
  the migration window (risk #4). See [shipped.md 2026-05-16 B2 entry](../shipped.md).
- [x] **Batch 3 — public shell + `index` + `robots` (L).** Shipped
  2026-05-16. `pages/app.tsx` → `ui/client/lib/SiteShell.tsx`
  (`'use client'`); class moved verbatim and re-exported as
  `LegacyAppClass` (named export), wrapped by a functional default
  `SiteShell` that pulls `t`/`i18n` from `useT('app')` (next-i18next
  v16 client subpath, not `useTranslation` — that name doesn't exist on
  `next-i18next/client`) and `pathname` from `usePathname()`. Pages-Router
  `pages/[...slug].tsx` (still B4 territory) re-pointed to import
  `LegacyAppClass` directly so it keeps using `next-i18next/pages`
  `useTranslation` via its own `appWithTranslation` HOC. `app/page.tsx`
  ← `pages/index.tsx` — async Server Component, calls
  `fetchInitialPageData()` per request, branches to `<LandingPage/>` on
  fresh installs (no published pages), otherwise renders
  `<SiteShell page="/" initialData={data}/>`. Pages-Router index used
  `getServerSideProps` (not SSG — see in-file comment about the Docker
  prebuild baking `showLanding=true`); the App-Router port inherits
  `dynamic='force-dynamic'` from the root layout, preserving the
  per-request contract. `app/robots.ts` ← `pages/robots.ts` (file was
  already in `MetadataRoute.Robots` shape — App-Router metadata convention;
  living under `pages/` was a historical accident, Pages Router doesn't
  recognise the shape). Deleted: `pages/app.tsx`, `pages/index.tsx`,
  `pages/robots.ts` — `app/` + `pages/` route collisions are hard Next
  errors. Scroll-mode hash redirect is the `[...slug].tsx` page's
  `useEffect` (lives outside SiteShell), untouched in this batch.
- [x] **Batch 4 — dynamic public routes (L).** Shipped 2026-05-16.
  `app/[...slug]/page.tsx` ← `pages/[...slug].tsx`: async Server
  Component, looks up the navigation row via `resolveSlugChain` (shared
  with the Pages-Router path), calls `fetchInitialPageData()`, hands
  `<SiteShell page=… pageId=… slugChain=… initialData=…/>`. Locale-prefix
  segments (`/lv/about`, `/lt/foo`) detected + stripped here since
  App-Router routes are NOT covered by `next.config.js`'s pages-router
  `i18n` block; active locale still resolves cookie-first in
  `app/layout.tsx`. `notFound()` from `next/navigation` for unresolved
  chains. `generateStaticParams` deliberately omitted — root layout is
  already `dynamic = 'force-dynamic'` so every render is per-request.
  `app/blog/page.tsx` + `app/blog/[slug]/page.tsx` ← `pages/blog/*`:
  Server-Component route + `BlogIndexView` / `BlogPostView` `'use client'`
  sub-components carrying antd `ConfigProvider` + `applyThemeCssVars`
  `useEffect` + `useTranslation`. SEO `<Head>` moved to
  `generateMetadata`; JSON-LD Article / Blog schema still emitted inline
  via `<script type="application/ld+json">` (the App-Router `Metadata`
  type has no first-class structured-data slot). Deleted:
  `pages/[...slug].tsx`, `pages/blog/index.tsx`, `pages/blog/[slug].tsx`.
  `LegacyAppClass` no longer exported from `ui/client/lib/SiteShell.tsx`
  — was solely a B3 seam for the now-removed Pages-Router catch-all.
  Scroll-mode hash redirect (the `useEffect` rewriting `/about` → `/#about`)
  was NOT ported — under app router the SSR'd standalone page still
  serves real HTML for crawlers; folded into SiteShell's own hash
  handler in a follow-up if QA flags it. See
  [shipped.md 2026-05-16 B4 entry](../shipped.md).
- [ ] **Batch 5 — commerce + account routes (XL).** `cars/*`,
  `products/*`, `cart/*`, `checkout/*`, `account/*`, `orders/*` — each
  with its own data-loading conversion. Largest batch; may split
  further per-route-group.
- [ ] **Batch 6 — auth + admin pages (M).** `app/admin/page.tsx` +
  `app/admin/{settings,languages,modules-preview}/page.tsx` ←
  `pages/admin*`. `getServerSession(req,res,authOptions)` →
  `getServerSession(authOptions)` + `next/navigation` `redirect()`
  (risk #8). `auth/*`, `welcome.tsx`, `dev/*`, `docs/*` pages.
- [ ] **Batch 7 — cleanup + cutover (S).** Delete `pages/_app.tsx` +
  `pages/_document.tsx` once no Pages-Router page remains. Audit
  `next-i18next.config.js` v16 shape. Verify `next-sitemap` post-build.
  Verify inline-translation-editor `reloadResources()` (risk #5). Full
  `npm run build` + Docker build + smoke checklist (see Phase 5 below).
  Strike the item from `README.md` + final `shipped.md` entry.

> The "Phased plan" / "Risk map" / "Phase 5 smoke checklist" sections
> below predate the batch split and remain the authoritative detail
> reference — the batches above are the delivery slices, the phases are
> the technical content.

## Current footprint (17 files)

Public pages
- `pages/index.tsx` — SSG, 1 hour revalidate. Hands `t`/`i18n` to `App`.
- `pages/[...slug].tsx` — SSG with `generateStaticParams` from nav GraphQL.
- `pages/blog/index.tsx` — public blog index.
- `pages/blog/[slug].tsx` — single post page.
- `pages/404.tsx` — custom not-found.
- `pages/robots.ts` — already in App-Router shape, trivial port.
- `pages/app.tsx` — 519-line **client class component** receiving `t`/`i18n`
  as props from each page. Holds the entire public shell (Tabs / ScrollNav /
  Mongo+PublishApi+ThemeApi+PostApi+FooterApi+SiteFlagsApi orchestration,
  language dropdown, `<Head>` SEO, refresh bus). Will become
  `ui/client/lib/SiteShell.tsx` (or similar) and call `useTranslation`
  itself instead of taking `t`/`i18n` props.

Admin pages
- `pages/admin.tsx` — admin entry, `getServerSession(req, res, authOptions)`.
- `pages/admin/settings.tsx`
- `pages/admin/languages.tsx`
- `pages/admin/modules-preview.tsx`

App shell (delete after migration)
- `pages/_app.tsx` — class App: NextCookies, universal-language-detector,
  `appWithTranslation` HOC, `SessionProvider`, service-worker unregister,
  `<InlineTranslationHost/>`, `<HighContrastAutoPick/>`, `<PresenceHost/>`.
- `pages/_document.tsx` — antd cssinjs `StyleProvider` via `enhanceApp`,
  theme CSS vars (`<style data-theme-vars>`), `<body data-theme-name>`,
  Google Fonts URL composed from active theme tokens, dead `preloadedData`
  inline script.

API (untouched; one fix only)
- `pages/api/revalidate.ts` — line 124 uses `res.revalidate(p)`. Once pages
  move to App router, this silently becomes a no-op for them. Replace with
  `revalidatePath(p)` from `next/cache`.

## Risk map (architecture-doc-derived)

### HIGH — silent regressions

1. **antd cssinjs SSR registry**. `_document.tsx` uses
   `extractStyle(cache, true)` via `enhanceApp`. Without an equivalent in
   App router you get FOUC + duplicate `<style>` tags **in production
   only**. Fix: wrap children in `<AntdRegistry>` from
   `@ant-design/nextjs-registry` (already in deps) inside the root layout.

2. **`<body data-theme-name="...">` must stay on `<body>`**. The themed
   SCSS contract uses `[data-theme-name="paper"] …` ancestor selectors.
   Resolving theme tokens server-side in `app/layout.tsx` and applying the
   slug to `<body>` is non-negotiable.

3. **Google Fonts URL is DB-driven, not buildtime**. Composed from active
   theme tokens via `buildGoogleFontsUrl`. Cannot use `next/font`. The
   layout must be `dynamic = 'force-dynamic'` OR have a sensible
   `revalidate` TTL. Document the tradeoff. Theme rollback (which resets
   `version`) interacts badly with default `force-cache`.

4. **`pages/api/revalidate.ts` `res.revalidate(p)`**. Becomes a no-op for
   App-router routes. Replace with `revalidatePath(p)` from `next/cache`.
   Preserve existing token auth + rate-limiting in the file.

5. **`InlineTranslationEditor.tsx` global `i18n.reloadResources()`**.
   Under v16 app-router each consumer gets its own instance. The pages-
   router subpath retains the global; if any consumer of the inline
   editor moves to app-router, `reloadResources()` becomes a no-op there.
   Currently reachable from both surfaces — verify post-migration; if
   broken, add a workaround using `useTranslation()` `i18n` instance from
   each consumer rather than the global.

6. **`mongoDBConnection.seedIfEmpty()` static flag**. The
   `MongoDBConnection.adminSeeded` boolean was designed for Pages Router's
   single-render-per-request model. App router runs server components in
   parallel; re-entry could double-seed. Replace the boolean with a
   Promise-based singleton: `private static seedingPromise: Promise<void>
   | null = null;` so concurrent callers await the same seed.

### MEDIUM — surface-level breaks (typecheck or runtime), easier to spot

7. **`_app.tsx` initial-props chain** (`universalLanguageDetect`,
   `NextCookies`, building `pageProps.lang`/`pageProps.cookies`/`isSSR`).
   Replace with `cookies()` + `headers()` reads inside layout.tsx server
   component. Grep for `pageProps.lang` and `pageProps.cookies` consumers
   before removing — pass through Context if needed.

8. **`getServerSession(req, res, authOptions)` admin gating**. v4 still
   supports the (req, res) form in pages router AND the (authOptions)
   form in app-router server components. Use the latter under app-router.
   Redirect via `next/navigation` `redirect()` instead of returning
   `{ redirect: { destination: '/login' } }` from gSSP.

9. **`SessionProvider` initial session**. Pass `session` from layout
   server component (`getServerSession(authOptions)`) into the client
   `<Providers>`. Without seeding, `useSession()` flickers `loading` on
   every mount → admin chrome briefly shows the login screen on tab
   focus.

10. **`serverSideTranslations(locale, ['app','common'])`**. Replace with
    v16 server helper from `next-i18next/server`. Read
    `node_modules/next-i18next/dist/appRouter/server.d.cts` for the
    actual signature — likely `await initI18next(locale, namespaces)` or
    similar — and wire resources to a client `<I18nextProvider>` if
    needed.

### LOW — already migration-friendly or small

11. `pages/robots.ts` — already exports `MetadataRoute.Robots` shape;
    just move the file.
12. `pages/404.tsx` → `app/not-found.tsx`.
13. `next-sitemap.config.cjs` — verify v4 supports App Router routes
    manifest (it does as of recent releases). Smoke-check the post-build
    sitemap output.
14. **`pages/app.tsx` lines 204–211** — dead `global.preloadedData` /
    `window.preloadedData` references already commented out. Delete
    rather than port. The `<script dangerouslySetInnerHTML>` payload in
    `_document.tsx` ships nav+sections graph to nobody — drop it.

## Phased plan

Order chosen so each phase ends in a runnable app. Verify between phases
with `npx tsc --noEmit -p ui/client/tsconfig.json` and `npm test`.

### Phase 1 — Foundation (1–1.5 days)

1. `ui/client/app/layout.tsx` (server component, root layout):
   - Reads `cookies()` + `headers()` for locale detection (port the
     `universalLanguageDetect` logic).
   - Resolves active theme tokens via `MongoConnection.themeService`.
   - Builds Google Fonts URL via `buildGoogleFontsUrl`.
   - Renders `<html lang>`, `<body data-theme-name>`, theme CSS vars
     `<style>` block, fonts `<link>`.
   - Decides `force-dynamic` vs `revalidate` (recommend `revalidate=60`
     with `revalidateTag('theme')` invoked from theme save endpoint).
2. `ui/client/app/providers.tsx` (`'use client'`):
   - `SessionProvider` (seeded from layout server component).
   - `<AntdRegistry>` from `@ant-design/nextjs-registry`.
   - `ConfigProvider` for antd theme.
   - `I18nextProvider` if needed for client translations.
   - Mount `<InlineTranslationHost/>`, `<HighContrastAutoPick/>`,
     `<PresenceHost/>` here.
3. Service-worker unregister: small `'use client'` component mounted in
   providers (port the `componentDidMount` block from `_app.tsx`).
4. mongoDBConnection re-entry guard: replace `adminSeeded` boolean with
   `seedingPromise` singleton.
5. **Verify:** `tsc` clean. App still serves the existing pages-router
   pages (we haven't deleted them yet).

### Phase 2 — Public pages (1 day)

1. Rename `pages/app.tsx` → `ui/client/lib/SiteShell.tsx`. Add
   `'use client'`. Drop `t`/`i18n` props; call `useTranslation('app')`
   inside. Update import paths in callers.
2. `app/page.tsx` ← `pages/index.tsx`. Server component, fetches
   `fetchInitialPageData()`, renders `<SiteShell page="/"
   initialData={data}/>`. `revalidate = 3600`.
3. `app/[...slug]/page.tsx` ← `pages/[...slug].tsx`. With
   `generateStaticParams` from nav GraphQL. Keep the scroll-mode redirect
   `useEffect` inside `SiteShell`.
4. `app/blog/page.tsx` ← `pages/blog/index.tsx`.
5. `app/blog/[slug]/page.tsx` ← `pages/blog/[slug].tsx`. With
   `generateStaticParams` + `generateMetadata` for SEO.
6. `app/not-found.tsx` ← `pages/404.tsx`.
7. `app/robots.ts` ← `pages/robots.ts`.
8. **Verify:** `tsc` + `vitest` + manual smoke on `/`, `/<slug>`,
   `/blog`, `/blog/<post>`.

### Phase 3 — Admin pages (0.5 day)

1. `app/admin/page.tsx` ← `pages/admin.tsx`. Server component:
   `const session = await getServerSession(authOptions);`
   `if (!session || session.user.role !== 'admin') redirect('/');`
2. `app/admin/settings/page.tsx`, `app/admin/languages/page.tsx`,
   `app/admin/modules-preview/page.tsx` — same pattern.
3. **Verify:** admin flows: login, save, publish, language switch,
   modules preview, presence bar updates.

### Phase 4 — Cleanup (0.5 day)

1. Replace `res.revalidate` in `pages/api/revalidate.ts` with
   `revalidatePath`. Keep token auth + rate limit untouched.
2. Delete dead `global.preloadedData` plumbing. Drop the inline
   `<script>` payload from the old `_document` (now in layout).
3. Delete `pages/_app.tsx`, `pages/_document.tsx`, all migrated page
   files. Keep `pages/api/`.
4. Audit `next-i18next.config.js` — v16 may not need the same shape.
   Read v16 docs.
5. Verify `next-sitemap` post-build still emits expected URLs.

### Phase 5 — Verify (0.5 day)

1. `npx tsc --noEmit -p ui/client/tsconfig.json` clean
2. `npx tsc --noEmit -p tsconfig.test.json` clean
3. `npm test` — all tests pass; update test imports for moved files
4. `npm run build` succeeds
5. Local Docker build via existing `infra/AppDockerfile` succeeds
6. Smoke checklist:
   - [ ] Public home renders with theme CSS vars + Google Fonts loaded
   - [ ] `<body data-theme-name>` matches active theme slug
   - [ ] Language dropdown switches locale; URL changes
   - [ ] Scroll-mode site renders all sections on `/`; legacy `/about`
         redirects to `/#about`
   - [ ] Blog index + post render with metadata
   - [ ] Admin login flow; `useSession()` does NOT flicker on tab focus
   - [ ] Admin save → publish → revalidate → public page reflects change
   - [ ] Inline translation editor still saves AND refreshes the page
         text (regression risk #5)
   - [ ] No FOUC, no duplicate `<style>` in prod build
   - [ ] No double-seeded admin user under cold-boot concurrent reqs

## Out of scope

- `next-auth@5` upgrade. v4 is fine under app router server components.
- Migrating API routes. They stay as Pages Router handlers — Next 16
  supports both concurrently.
- App Router parallel routes / intercepting routes / loading.tsx /
  error.tsx polish. Add later when needed.
- Replacing `gqty` SSR `resolve()` calls with `fetch`-based caching.
  Functional under app router, just not optimal.

## Estimated effort

3–4 working days, single dev. Bulk is in Phase 2 (porting the heavy
shell + verifying SSG paths) and Phase 5 (smoke testing under Docker).
Phases 1 + 4 are mechanical; Phase 3 is small.

## Rollback

All phases are additive until Phase 4. If Phase 2 or 3 surfaces
unsolvable regressions, the worktree can be discarded and we ship just
the Phase 1 foundation (which doesn't disable anything). The risk-free
exit is: keep using `next-i18next/pages` subpath imports indefinitely.
