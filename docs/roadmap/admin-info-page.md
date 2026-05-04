# F5 — admin diagnostic / version info page

## Goal

Admin-gated page at `/admin/system/info` that surfaces the CMS's runtime state in one place: build version, deployment slot, route registry, feature manifest summary, cache + service health, idempotency + trash counts. Used by operators in production to verify a deploy landed correctly, that all platform routes are live, that the right blue/green slot is active, and that core services are healthy.

Out of scope for v1: real-time metrics dashboards (Grafana/Prom belong outside the admin), public-facing status page, customer-visible incident banner.

## Why now

- Operators need a way to verify a deploy in production — "is `/admin/build` reachable, is `/api/graphql` returning, are core services healthy." Today this requires `curl` + log-grep. (F3 `/v1/**` namespace was attempted and cancelled — see [v1-url-namespace.md](v1-url-namespace.md) postmortem; routes stayed at `/admin/*` and `/api/*`.)
- C9 caching introduced `bootId`. There's no UI surface that exposes it; ops have to read the response header `X-Cms-Cache-Tag` to find it.
- F2 added `*.trash` collections + idempotency Redis namespace. Admins want a "what's in the trash today, how many idempotency keys are live" overview without going to mongo shell.
- After every deploy, the operator's first instinct is "did the right SHA roll out, did the seamless deploy flip, are blue and green pointing at the right images." Surfacing this avoids ssh'ing the box.

## Design

### Surface

`/admin/system/info` — under the existing `system` area, alongside `users`, `mcp`, `inquiries`, `features`, `agent`. Admin rank required (existing area-nav `adminOnly` flag covers it).

### Sections

1. **Build identity**
   - Git SHA (from `.git-sha` baked into the AppDockerfile during build — see C9 / Q-Q9 work).
   - Build timestamp (from the same source).
   - Active blue/green slot (env var `ACTIVE_UPSTREAM` exposed by Caddy / orchestrator).
   - Boot ID (already exposed via `/api/health`).
   - Process uptime.
   - Deployment env (`NODE_ENV`, plus a soft-flag like `vars.DEPLOY_TIER = 'prod' | 'staging' | 'dev'`).

2. **Route registry**
   - List every platform route, hit each with a HEAD request, show 200/301/308/404/5xx + response time.
   - Categorize: admin pages (`/admin/...`), API (`/api/...`).
   - "Customer page slug check" — pick a known customer page (configurable via `vars.SMOKE_PAGE_SLUG = 'home'`) and HEAD `/${defaultLocale}/${slug}` to confirm the public route resolves.

3. **Feature manifest**
   - Walk `featureRegistry`. For each feature: id, displayName, status (enabled/coreInfrastructure), exposed mutations + queries count, gated mutation count, cascade rule count, batch-accessor count.
   - Highlights features missing expected pieces (e.g. a feature with mutations but no `resourceGated`).

4. **Storage health**
   - Mongo: connection status, replica-set vs single-node, transaction support, current `bootId`.
   - Redis: connection status, keys count by namespace (`idempotency:*`, `cache:*`, `lock:*`).
   - Cache versions: every key in the `cacheVersionKeys` registry with its current value.

5. **Trash overview**
   - For each `*.trash` collection: row count, oldest entry timestamp, group count.
   - "Restore" link per `trashGroup` → existing `/admin/release/trash`.

6. **Idempotency snapshot**
   - In-flight count + recent-collapse count from `IdempotencyService.stats()` (new method).
   - Top 5 most-collided keys from the last hour (if Redis exposes it cheaply; skip otherwise).

7. **Authorization snapshot**
   - Total grant rows in `Permissions`. Breakdown by scope (`feature`, `page`, `locale`).
   - Functional roles registered + their assignment counts.

### Implementation

- New feature folder `services/features/Diagnostics/` with `DiagnosticsService` + `DiagnosticsServiceLoader`. SDL exposes one query: `getDiagnostics: String!` returning a JSON blob. Admin-only (`queryRequirements: {getDiagnostics: 'admin'}`).
- New admin pane `ui/admin/features/Diagnostics/Diagnostics.tsx` + `DiagnosticsViewModel.ts` + `DiagnosticsAdminUILoader.ts`. Route `/admin/system/info`. VM3 (no `useState`).
- Service composes the snapshot from existing infrastructure: read `featureRegistry`, query the boot-id from `/api/health` internally (or expose `bootId` via service), introspect `mongoDBConnection.client.options`, hit Redis `INFO`, count Trash collections.
- Route registry section: a static list seeded from the `featureRegistry` + `AdminUILoader.adminPane.route` discovery — no separate registry file. The HEAD probes run client-side from the admin VM (parallel `Promise.allSettled`) so the server doesn't have to know its own URL space.

### Caching + cost

- The diagnostic blob is expensive. Cache server-side for 5s with a "Refresh" button that bypasses the cache (`cache: 'no-store'`).
- The HEAD probes cost ~1 round trip per route (10-20 routes); fan out client-side, total ~200ms in prod.

## Files to touch

- `services/features/Diagnostics/DiagnosticsService.ts` (new) — composer
- `services/features/Diagnostics/DiagnosticsServiceLoader.ts` (new)
- `services/features/Diagnostics/feature.manifest.ts` (new)
- `services/features/Diagnostics/feature.manifest.test.ts` (new)
- `ui/admin/features/Diagnostics/Diagnostics.tsx` (new)
- `ui/admin/features/Diagnostics/DiagnosticsViewModel.ts` (new)
- `ui/admin/features/Diagnostics/DiagnosticsAdminUILoader.ts` (new)
- `ui/admin/lib/loaders/adminUILoaderRegistry.ts` — register loader
- `ui/admin/shell/UserStatusBar.tsx` — add `system/info` to the `system` area items
- Optional: extend `IdempotencyService` with `stats(): {inFlight: number, ttlSeconds: number, recentHits: number}` (new method, used by section 6).

## Acceptance

- [x] Admin visits `/admin/system/info` → sees all 7 sections render in <300ms.
- [x] The Build identity section shows the same Git SHA as `git rev-parse HEAD` of the deployed image.
- [x] The Route registry section shows green ticks for every platform route (HEAD probed client-side via `Promise.allSettled`).
- [ ] Editing a customer page slug + hitting Refresh updates the "customer page slug check" row immediately — pending the smoke-page slug section (deferred; not blocking).
- [x] Non-admin hits the same URL → standard 401 + redirect to login (`buildAdminSsr({adminOnly: true})` + manifest `queryRequirements.getDiagnostics: 'admin'`).
- [x] Tests: feature manifest gated test, service unit test (composer logic on a mocked feature registry), VM render test asserting all 7 sections appear, public-endpoint shape test.

## Shipped 2026-05-03

- Backend: `services/features/Diagnostics/` (Loader, Service, manifest, two tests).
- Public endpoint: `ui/client/pages/api/info.ts` returning `{version, bootId, buildTimestamp}` only — audited for env-secret bleed.
- Admin pane: `ui/admin/features/Diagnostics/` (VM3, no `useState`); registered in `adminUILoaderRegistry`.
- Route: `ui/client/pages/admin/system/info.tsx` + `system/info` entry on the System area rail with `InfoCircleOutlined` icon (no `MonitorOutlined` adapter exists in `icons.tsx`).
- `IdempotencyService.stats()` added (counts only — no key strings).
- Locked decisions: nested under System; public `/api/info`; manual Refresh only.

## Risks / notes

- The route-registry HEAD probes from the browser may hit auth (admin pages return 200 only when the caller is signed in) — that's by design. The probe should `credentials: 'same-origin'` so it carries the cookie.
- Idempotency stats from Redis can be expensive on a busy instance. Recommend gating section 6 behind a "Show advanced" toggle if `redis.dbsize()` returns >100k keys.
- Don't expose the Mongo connection URI or any env secret in the response. Audit what's in the JSON blob before merging.
- Don't expose customer PII (e.g. user email lists). Section 7 shows counts, not names.

## Effort

**M · 1-2 engineering days**

- Service composer + tests: 0.5 day
- Admin pane (7 sections + VM): 0.5–1 day
- Route registry HEAD-probe wiring: 0.25 day
- Idempotency `stats()` + auth-snapshot count + cache-version reader: 0.25 day
- Polish + smoke test on the deployed env: 0.25 day

## Dependency notes

- Pairs with F3 (the page is where you verify F3 landed correctly).
- Composes with F2 (Trash + idempotency stats live here).
- Uses C9 boot-id exposure (already shipped).
- Doesn't gate on F4 (SCSS scoping audit — UI is small enough to ship under existing conventions).

## Open questions

1. **Where in the admin sider** — `/admin/system/info` (under the System area, my recommendation) or its own top-level area "Diagnostics"? Recommend nest under System; ops-only feature, no need for a top-bar button.
2. **Public/anonymous endpoint** — should a stripped-down JSON (build SHA + boot-id + version) be exposed at `/api/info` (no auth) for external monitors (UptimeRobot, status pages)? Recommend YES, returning only safe public fields.
3. **Polling vs static** — should the page auto-refresh every 30s? Recommend NO; manual Refresh button + the cached server-side blob is enough. Auto-refresh adds load with no operational benefit beyond "see uptime tick up."
