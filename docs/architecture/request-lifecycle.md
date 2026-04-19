# Request lifecycle

Two paths: a public-page render (read-mostly, statically generated where possible) and an admin mutation (always-fresh, conflict-checked). Both terminate in the same `MongoDBConnection` singleton.

## Public page render

```
Browser
  │
  ▼
Next.js (SSG/ISR or SSR depending on route)
  │
  ├─ getStaticProps / getServerSideProps
  │     │
  │     ▼
  │   resolve(...) via GQty client (`src/frontend/gqty/`)
  │     │
  │     ▼
  │   /api/graphql → Apollo Server (`src/frontend/pages/api/graphql.ts`)
  │     │
  │     ▼
  │   Resolver map (`src/Server/graphqlResolvers.ts`)
  │     │
  │     ▼
  │   `getMongoConnection()` singleton (`src/Server/mongoDBConnection.ts`)
  │     │
  │     ▼
  │   Service method (e.g. `NavigationService.getSections`)
  │     │
  │     ▼
  │   MongoDB driver → Mongo
  │
  ▼
HTML + `<style data-theme-vars>` (active theme tokens injected in _document.tsx)
  +
JSON island via `window.preloadedData = ...` for the React app
```

Routes by mode (see also [`PROJECT_ANALYSIS.md`](../../PROJECT_ANALYSIS.md#rendering-mode)):

| Route | Mode | Why |
|---|---|---|
| `/` | `getStaticProps` | First-paint speed; baked-in nav + theme + footer |
| `/[...slug]` | `getStaticProps` + `getStaticPaths` | Same, per-page; ISR-friendly |
| `/blog`, `/blog/[slug]` | `getServerSideProps` | Honours `blogEnabled` flag, drafts shouldn't be cached |
| `/admin*` | `getServerSideProps` | Always-fresh; primes session + i18n; locale JSON returned with `Cache-Control: no-store` |

## `_document.tsx` server-side priming

[`pages/_document.tsx`](../../src/frontend/pages/_document.tsx) runs in `getInitialProps` on every page load (SSG and SSR alike) and:

1. Pulls the **active theme** via `themeService.getActive()` and converts its tokens to a `:root { --theme-* … }` CSS rule injected as `<style data-theme-vars>`. **No FOUC** — the first paint already has the theme.
2. Reads the same active theme's font family tokens, dedupes against a `BUNDLED_FAMILIES` allowlist (the seeded Paper / Studio / Industrial faces), and composes a single `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?…">` URL so theme switches don't FOUC their typography either. Composer in [`theme/googleFonts.ts`](../../src/frontend/theme/googleFonts.ts).
3. Sets `<body data-theme-name={slug}>` so editorial themes' SCSS overrides (`[data-theme-name="paper"] …`) match in production. Preview cards do the same on a wrapper `<div>` — no `body` ancestor in any selector. See [`THEMING.md`](../../THEMING.md#theme-slug-scoping-contract-paper--studio--industrial).
4. Preloads the navigation + sections graph (`global.preloadedData` + `window.preloadedData`) so the React shell hydrates without waiting on a second GraphQL round-trip.

## Admin mutation

```
Browser (admin form)
  │
  ▼
Frontend API wrapper (e.g. `SectionApi.addRemoveSectionItem`)
  │
  │  reads `section.version` from local state, sends as `expectedVersion`
  ▼
GQty mutation → /api/graphql
  │
  ▼
Apollo Server → resolvers → `MongoDBConnection.addUpdateSectionItem`
  │
  │  authz Proxy (`src/Server/authz.ts`) gates on session.role + capability
  │  + injects `_session` for methods that need to stamp `editedBy`
  ▼
`NavigationService.addUpdateSectionItem`
  │
  │  reads existing doc → `requireVersion` (throws ConflictError on mismatch)
  │  writes update with `version: nextVersion(existing)` + `auditStamp(email)`
  ▼
JSON response shape:
  - success: `{updateSection: {id, version}}`
  - conflict: `{conflict: true, currentVersion, currentDoc, message}`
  │
  ▼
Frontend: `parseMutationResponse` (in `src/frontend/lib/conflict.ts`)
  │
  │  detects conflict shape → throws ConflictError
  ▼
Editor catches → opens `<ConflictDialog>` (Take theirs / Keep mine)
```

The conflict path is wired end-to-end for sections; other editors (Theme, Post, Settings) accept `expectedVersion` server-side but their UIs don't yet send it. See `roadmap/multi-admin-conflict-mitigation.md` for the rollout plan.

## Caching layers (where they bite)

| Layer | Where | Lifetime |
|---|---|---|
| Next.js static cache | `getStaticProps` outputs | Until next deploy / ISR revalidate |
| GQty in-memory cache | Per browser tab | Until `invalidateCache()` (called after every mutation) |
| `ThemeApi.getActive` 30s cache | [`api/ThemeApi.ts`](../../src/frontend/api/ThemeApi.ts) | 30s, invalidated on theme mutations |
| `_document` `global.preloadedData` | Module-level on the server process | Per-request (overwritten on each `getInitialProps`) |
| Mongo driver pool | `MongoClient` `maxPoolSize: 80` | Process lifetime |

Bug shape to watch for: stale data after a mutation that didn't call `invalidateCache()`. Every mutation in [`SectionApi`](../../src/frontend/api/SectionApi.ts) / sibling APIs ends with `invalidateCache()` + `refreshBus.emit('content' | 'settings')` — the latter triggers `useRefreshView` subscribers in admin tabs to refetch.

## Two GraphQL processes, one schema

- **`src/frontend/pages/api/graphql.ts`** — Apollo Server embedded in Next, used by NextAuth + GQty + the admin UI.
- **`src/Server/index.ts`** — Standalone Express + `express-graphql`, started via `npm run standalone-graphql`. Same schema, same singleton, used as the `server` container in `compose.yaml`.

Both call `getMongoConnection()` which returns the same module-level singleton — `seedIfEmpty()` is guarded by a static flag so the preset themes / admin user only seed once per process.

Last reviewed: 2026-04-19.
