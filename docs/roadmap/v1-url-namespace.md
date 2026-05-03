# F3 — namespace CMS URLs under `/v1/**`

## Goal

Move every CMS-managed URL (admin UI, API routes, internal management endpoints) under a versioned prefix `/v1/**`. The public client owns the entire root + locale-prefixed namespace (`/`, `/[lang]/...`, `/[lang]/[...slug]` once F1 sub-pages lands). After this change there is no path under which a customer's page slug could collide with the platform's own routes.

Out of scope for v1: a `/v2/**` migration plan (we'll cross that bridge later); changing the locale prefix model.

## Why now

- F1 (sub-pages) introduces a `[...slug]` catch-all on the public side. The catch-all is greedy — a customer creates a page slug `admin` and it collides with `/admin/...` unless Next.js routing carefully precedes it. Today this works by Next's static-route precedence, but it's an accident of file layout, not a contract.
- A customer slug `api`, `admin`, `setup`, `health`, `_next`, `favicon.ico` etc. is a foot-gun. Reserved-slug lists are brittle (every new internal route adds another reserved word).
- A versioned prefix is the standard way to leave room for future breaking changes to the platform's own URL contract — the same way we already version the GraphQL SDL.

## Design

### URL contract

| Today | After |
|---|---|
| `/admin/...` (admin UI) | `/v1/admin/...` |
| `/api/...` (Next API routes) | `/v1/api/...` |
| `/api/health` | `/v1/api/health` |
| `/api/graphql` | `/v1/api/graphql` |
| `/api/setup` | `/v1/api/setup` |
| `/api/log/error` | `/v1/api/log/error` |
| `/api/upload`, `/api/upload-batch` | `/v1/api/upload`, `/v1/api/upload-batch` |
| `/api/export`, `/api/import` | `/v1/api/export`, `/v1/api/import` |
| `/api/rescan-images` | `/v1/api/rescan-images` |
| `/api/onboarding/...` | `/v1/api/onboarding/...` |
| `/api/agent/...` | `/v1/api/agent/...` |
| `/api/auth/...` (NextAuth) | `/v1/api/auth/...` |
| `/api/inquiry`, `/api/inquiries` | `/v1/api/inquiry`, `/v1/api/inquiries` |
| `/api/presence`, `/api/revalidate` | `/v1/api/presence`, `/v1/api/revalidate` |
| `/api/fonts/...` | `/v1/api/fonts/...` |
| `/api/favicon`, `/api/[name]` | `/v1/api/favicon`, `/v1/api/[name]` |
| **Public client (unchanged):** `/`, `/[lang]/...`, `/[lang]/[...slug]`, `/blog`, `/blog/[slug]` | same |
| **Static assets (unchanged):** `/_next/...`, `/favicon.ico` | same |
| **Dev-only assets (unchanged):** `/CV/...` is a development-time directory, not CMS-served — left at root, not under `/v1/`. Never appears in customer routes. | same |

The public client retains the root namespace. Customers can name a page `admin` and it'll resolve as their page; their page never collides with the platform.

### Implementation

1. **Move directories.**
   - `ui/client/pages/admin/**` → `ui/client/pages/v1/admin/**`
   - `ui/client/pages/api/**` → `ui/client/pages/v1/api/**`
   - Next.js file-based routing handles the prefix automatically; no extra config.
2. **Internal callsite sweep.** Every `fetch('/api/...')`, every gqty `endpoint`, every `<Link href="/admin/...">`, every redirect target, every test fixture base URL. Use a codemod / global-replace with a regex that distinguishes string literals from substrings of arbitrary words. Manual review of edge cases (Caddyfile, Dockerfile, runbooks, README).
3. **Backwards compat — 308 redirects.** `next.config.js` `redirects()` function maps old paths to new for one release cycle, then drops:
   ```
   /admin/:path* → /v1/admin/:path* (308 permanent)
   /api/:path*   → /v1/api/:path*   (308 permanent)
   ```
   - Q5 admin-segregation observability already logs `scope: legacy-route` hits; the same mechanism reports on `scope: v0-redirect` so we can tell when the redirect rule is safe to drop.
4. **NextAuth callback URLs.** `nextauth` config + the OAuth provider configurations have absolute callback URLs. Update both. Document in [runbooks/nextauth-config.md](../runbooks/nextauth-config.md) (new).
5. **Caddy.** Caddyfile reverse-proxies `/api/*` for SWR cache control. Update path matchers.
6. **External integrations.**
   - Webhooks the customer might have wired (Stripe, Resend, etc.) pointing at `/api/...` need to be updated post-migration. The 308 redirect covers it during the transition window; after the redirect drops, broken webhooks fail loudly.
   - Public health-check pollers, uptime monitors, status pages.
7. **GraphQL endpoint.** The gqty client and the public agent-stream handler hit `/api/graphql`. Update the constant; add a regen step for the gqty schema doc.
8. **Documentation pass.** Every runbook, every roadmap entry, every README that mentions `/admin/...` or `/api/...`. Most of these are already paths in shipping code, so the codemod catches them.

### Public-side routing

Next.js routes by file layout. With `/admin` and `/api` *gone* from `pages/`, the catch-all `/[lang]/[...slug]` is the *only* route under root (besides static assets) — no special-case ordering needed, no reserved-slug list. Sub-page resolution (F1) is unaffected since it operates on the catch-all chain.

The static assets (`_next`, `favicon.ico`, `images`, `CV`) are served by Next's static handler, which short-circuits before the page router runs — they don't go through the catch-all and are immune.

## Files to touch

- Move: `ui/client/pages/admin/`, `ui/client/pages/api/` → `ui/client/pages/v1/...`
- `next.config.js` — `redirects()` block; any `rewrites()` or path-based config
- Caddyfile — path matcher rewrite
- `services/api/client/MongoApi.ts` and friends — endpoint constants
- `ui/client/lib/agent/agentClient.ts` (or equivalent) — stream URL
- `ui/admin/lib/...` — admin-side fetch URLs
- All `tests/e2e/**/*.spec.ts` — base URL fixtures
- All `*.integration.test.ts` — handler import paths (paths change with the move)
- `playwright.config.ts` — webServer URL config
- NextAuth provider config (env + code)
- `docs/runbooks/**/*.md` — every URL reference
- `docs/site/**/*.md` — customer-facing docs

## Acceptance

- `/admin/build` returns 308 → `/v1/admin/build` for the deprecation window; after drop, returns 404 (intentional).
- `/api/health` returns 308 → `/v1/api/health`; after drop, 404.
- Customer creates a page slug `admin`. Visit `/lv/admin` → renders the customer's page, not the admin UI.
- All E2E specs pass.
- All integration tests pass.
- gqty regen produces the same schema (URL change only; SDL unchanged).
- Caddy SWR cache headers continue to evict on admin write (smoke-test export/import via the new paths).

## Risks / notes

- **External integrations break at redirect-drop time.** This is the planned cost; the 308 window is the warning. Document loudly in the changelog.
- **Codemod miss.** A literal `'/api/'` substring inside a longer string (e.g. `'See /api/setup for details'` in a help text) gets mangled by a careless replace. Use word-boundary regex + manual review of any matches that aren't on a line that looks like a fetch / Link.
- **Search engines.** Public sitemap is unchanged (root + `/[lang]/[...slug]`). Admin / API are not crawlable. No SEO impact.
- **Bookmark rot.** Internal team members with bookmarked admin URLs get redirected once, then bookmark the new URL. Communicate in advance.

## Effort

**M · 1-2 engineering days**

- Directory move + Next-config redirects: 2 h
- Internal callsite sweep + codemod: 3-4 h
- NextAuth + Caddy + external integration audit: 2 h
- Doc pass: 1-2 h
- Smoke test + E2E + observability hookup: 2-3 h

## Dependency notes

- **Pairs with F1 sub-pages.** Doing F3 *before* F1 is cleaner — F1's catch-all routing assumes the platform owns no root-level paths it could collide with. Doing them together also works (single migration; one redirect window). Doing F1 first means we ship reserved-slug logic only to delete it on F3.
- **Composes with F2 cascade cleanup.** No interaction; URL changes are orthogonal to data integrity.

## Open questions

1. **Prefix name** — `/v1/` is the obvious choice (matches GraphQL SDL versioning, conventional for platform vs. content split). Alternatives: `/_/` (concise, conventional for "internal/system"), `/cms/` (descriptive), `/platform/`. `/v1/` wins on familiarity + room-for-v2.
2. **Redirect window** — 1 release cycle (a few days for an active project) or longer (4 weeks)? Longer is friendlier to external integrations but extends the period where two URLs both work and hurt observability. Recommend 1 release cycle, communicated in advance.
3. **Static-asset reorganization** — closed 2026-05-03. `public/images/` doesn't exist. `public/CV/` is dev-only (not CMS-served). `_next/` and `/favicon.ico` are framework conventions. F3 leaves `public/` untouched.
