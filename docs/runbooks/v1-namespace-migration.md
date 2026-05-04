# Runbook — `/v1/**` namespace migration (F3) — CANCELLED 2026-05-03

> **Cancelled — superseded by [docs/roadmap/v1-url-namespace.md](../roadmap/v1-url-namespace.md) postmortem.** Pages Router special-cases `pages/api/*`; moving it broke server/browser bundle isolation. F3 was reverted within a single working session and never ran in production. This runbook is preserved (not deleted) only because operators may have bookmarked it during the in-flight period. **Do not follow any instructions below.** Routes stay at `/admin/*` and `/api/*`; no OAuth callback URL changes; no 308 redirect drops to schedule.

---

## (Historical — do not follow) What changed

## What changed

- **Directory move.** Every Next.js page that was under `ui/client/pages/admin/**` or `ui/client/pages/api/**` (plus the `pages/admin.tsx` shell entry) now lives under `ui/client/pages/v1/...`. The standalone `pages/admin.tsx` moved to `pages/v1/admin.tsx`.
- **Internal callsite sweep.** ~170 quoted URL string literals (`fetch('/v1/api/...')`, `<Link href="/v1/admin/...">`, `route: '/v1/admin/...'`) and backtick template literals (`` `/v1/admin/${view}` ``) updated across `services/`, `ui/`, and `tests/`. Relative-path handler imports in `ui/client/tests/pages/api/*.integration.test.ts` retargeted from `'../../../pages/api/...'` to `'../../../pages/v1/api/...'`. Same for `@client/pages/api/...` aliased imports.
- **`next.config.js` redirects.**
  - 308 permanent: `/admin/:path*` → `/v1/admin/:path*`, `/api/:path*` → `/v1/api/:path*`. Plus a `/admin` (no path) → `/v1/admin` rule.
  - Existing locale-prefix bookmarks (`/lv/admin/...`, `/it/admin/...`, `/lt/admin/...`, `/ru/admin/...`) now retarget `/v1/admin/...`.
  - Phase-2 admin-segregation aliases (`/admin/settings`, `/admin/languages`, `/admin/modules-preview`) keep their existing temporary 307 redirects but now land on `/v1/admin/...` targets. A mirror set on `/v1/admin/{settings,languages,modules-preview}` covers post-F3 typos.
- **`next.config.js` rewrites.** `/robots.txt` and `/sitemap.xml` now rewrite to `/v1/api/...`.
- **Standalone GraphQL server (`services/index.ts`).** Registers `/v1/api/graphql` (was `/api/graphql`). Build-time SSG via gqty hits this. The Docker container-internal `/` mount is unchanged.
- **gqty fetcher (`services/api/generated/index.ts`).** Browser branch and the dev-localhost branch both use `/v1/api/graphql`. Docker `http://server:port/` mount unchanged.
- **Compose health-checks (`infra/compose.yaml`).** `app` and `app-green` healthchecks now hit `http://localhost:80/v1/api/health` directly (avoiding the 308 hop).
- **Caddyfile (`infra/Caddyfile`).** `@legacyApiImages` matcher (regex `^/api/([^/]+\.(?i:jpe?g|png|webp|gif|svg|avif))$`) **stays at `/api/...`**. This is a separate URL contract — Caddy serves uploaded image files directly from disk, bypassing Next. `PUBLIC_IMAGE_PATH` (`shared/utils/imgPath.ts`) stays `'api/'` so existing image references in MongoDB resolve unchanged. Reverse-proxy is path-agnostic; everything else (including `/admin/...` / `/api/...` requests) flows through and gets 308'd by Next.
- **Public client untouched.** `/`, `/[lang]/...`, `/[lang]/[...slug]`, `/blog/...`, `/_next/...`, `/favicon.ico` are all unchanged. Customers can still create page slugs `admin` or `api` and the catch-all owns them.

## Verification (post-deploy)

1. **308 redirects fire.**
   ```bash
   curl -I https://<domain>/admin/build       # expect 308 → /v1/admin/build
   curl -I https://<domain>/api/health        # expect 308 → /v1/api/health
   curl -I https://<domain>/api/graphql       # expect 308 → /v1/api/graphql
   ```
2. **New URLs serve.**
   ```bash
   curl -I https://<domain>/v1/api/health     # expect 200
   curl -I https://<domain>/v1/admin/build    # expect 200 (or 401/302 to login)
   ```
3. **Customer slug `admin` does not collide.** In a clean tenant: create a page with slug `admin`, visit `/<lang>/admin`. Expect: customer's page rendered. Expect NOT: admin shell.
4. **Compose healthcheck passes.** `docker compose ps` shows `app` as healthy within 90 s.
5. **Caddy SWR cache eviction.** Trigger an admin write (e.g. import a bundle, or edit a page), then re-fetch the public page. The `X-Cms-Cache-Tag` header should reflect the bumped feature version. (Caddy reverse-proxy is path-agnostic; the cache layer keys on URL + tag header, so the namespace move is transparent. Smoke-confirm anyway.)
6. **Sitemap + robots.** `https://<domain>/sitemap.xml` and `/robots.txt` return content (rewrite path now resolves through `/v1/api/...`).
7. **GraphQL.** Anonymous query through `/v1/api/graphql` returns expected payload. Apollo Server Sandbox at `/v1/api/graphql` is reachable for admins.

## When to drop the 308 redirects

After **1 release cycle** (a few days for an active project). Drop criteria:

1. Observability shows zero hits with `scope: v0-redirect` in the errors panel for ≥ 3 consecutive days.
2. All known external integrations (webhooks, uptime monitors) confirmed updated. Audit list:
   - Stripe webhooks → `/v1/api/...` if any
   - Resend / mail webhooks
   - Status pages / external uptime checks
   - Any internal CI/CD or scripts that hit `/api/health`
3. Bookmark rot communicated to internal team (announcement in changelog, internal channel).

To drop, delete from `ui/client/next.config.js`:
- `{source: '/admin', destination: '/v1/admin', permanent: true}`
- `{source: '/admin/:path*', destination: '/v1/admin/:path*', permanent: true}`
- `{source: '/api/:path*', destination: '/v1/api/:path*', permanent: true}`

Keep the locale-prefix and Phase-2 rules (separate concern). After drop, `/admin/build` and `/api/health` return 404 — by design.

## NextAuth callback URL — env var update needed

Per [docs/runbooks/nextauth-config.md](nextauth-config.md) (TODO if not present), if any OAuth provider config references absolute callback URLs containing `/api/auth/callback/<provider>`, update the OAuth provider's allowed-callbacks list to **also include** `/v1/api/auth/callback/<provider>`. The 308 redirect covers GET callbacks transparently for browsers, but some OAuth flows POST to the callback — POST + 308 is supported by spec but a few legacy OAuth clients drop the body on redirect. Update the provider config to remove the redirect hop entirely.

Env var summary:
- `NEXTAUTH_URL` — unchanged (still the apex domain).
- OAuth provider dashboards (Google, GitHub, etc.): add `<NEXTAUTH_URL>/v1/api/auth/callback/<provider>` to allowed callbacks. Drop the old `/api/auth/callback/<provider>` once the 308 redirects drop.

## For existing prod droplets

If you are upgrading a droplet that was running pre-F3 code, do **not** treat this runbook as the full upgrade procedure. It documents *what* changed and *how to verify* post-deploy. The end-to-end upgrade procedure — pre-flight, OAuth callback updates, backup, blue/green flip, smoke walk, rollback, and the redirect-drop deploy that follows the window — lives in [upgrade-droplets.md](upgrade-droplets.md). Run [upgrade-dry-run.sh](../../tools/scripts/upgrade-dry-run.sh) locally first as a rehearsal, then walk [upgrade-smoke-checklist.md](upgrade-smoke-checklist.md) on each droplet post-flip.

## What did NOT change (and why)

- **`shared/utils/imgPath.ts` — `PUBLIC_IMAGE_PATH = 'api/'`.** Image references in DB use this prefix; Caddy `@legacyApiImages` serves them directly from disk. Independent of the API namespace migration. If we ever migrate this, all stored image refs need a Mongo update — out of scope for F3.
- **`services/` source directory.** URL-only migration per spec. The backend feature loaders stay where they are.
- **`public/`.** User temp territory. Untouched.
- **Caddy reverse-proxy + SWR cache.** Path-agnostic; the cache module keys on URL + `X-Cms-Cache-Tag` header. Migration is transparent.
- **`/[lang]/[...slug]` catch-all.** Customers own root. F3 does not touch the public-side router.

## Rollback

Revert the F3 commit. The 308 redirects in `next.config.js` are the only runtime change with persistence implications — rolling back removes them. Customer URLs were never re-routed (public client owns root), so no data migration is needed.
