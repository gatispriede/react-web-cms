# Production caching + deploy hardening — session execution log

_Session: 2026-04-24_

End-to-end execution of the roadmap in
[`production-caching.md`](./production-caching.md) plus deploy plumbing
adjustments. All four tiers landed in this session; Tier 5 (CDN,
per-PR previews) remains deferred.

## Goal recap

From the user, in order of priority:

1. Images loaded from cache as priority #1.
2. Cache revalidated on admin changes (Next on-demand ISR — static
   regeneration on save when possible).
3. Less pressure on the server on the admin side.
4. Look into presence polling.
5. Generalize non-generic folder names (e.g. `design-v2`).
6. Deploy only to `funisimo.pro` for now; second droplet
   (skyclimber.pro) deferred but secrets retained.

Constraints gathered during the session:

- `design-v2` is "just an upload folder, outside of codebase".
- Site-settings theme change affects the whole site; module-level
  theme change affects only that page.

---

## Tier 1 — image cache + dead code

### Landed

- **Atomic writes in `optimizeImageFile`**
  (`services/features/Assets/imageOptimize.ts:170`). Stages output at
  `destPath + '.tmp-<pid>-<rand>'` then `fs.rename`s into place. Caddy's
  `file_server` streams from the bind mount, so a plain `writeFile`
  races with in-flight GETs — a client could cache a truncated buffer.
  Covers both `upload.ts` and `upload-batch.ts`.

- **Removed `ui/client/pages/api/[name].ts`.** Served
  `GET /api/<filename>.ext` via sync `fs.readFileSync` — event-loop
  blocker. Dead in prod since the Caddy hotfix: `@legacyApiImages`
  regex (`^/api/([^/]+\.(?i:jpe?g|png|webp|gif|svg|avif))$`) intercepts
  the URL and serves from `/srv/uploads/images/` before reaching Next.

- **Removed `ui/client/pages/api/media/[...path].ts`.** Streaming GET
  handler for `/api/media/images/foo.jpg`. Zero callers in the codebase.
  Caddy's `@uploads path /images/* /design-v2/*` covers every real URL.

- **Caddy matcher generalized** (`infra/Caddyfile:15`).
  `@uploads path /bundles/* /design-v2/* /images/*`. `/bundles/*` is
  the new generic path for per-site theme/design bundles; `/design-v2/*`
  kept as a back-compat alias so existing content URLs resolve.

- **Bind-mount + directory plumbing** for `bundles`:
  - `infra/compose.yaml:72` — added `./uploads/bundles:/app/ui/client/public/bundles`.
  - `.github/workflows/ci.yml:109` — `mkdir -p uploads/bundles` added.
  - `tools/scripts/server-init.sh:66` — `mkdir -p "$APP_DIR/uploads/bundles"`.
  - `design-v2` mount/mkdir retained alongside.

### Findings worth keeping

- Upload endpoints (`/api/upload`, `/api/upload-batch`) never went
  through the deleted GET handlers — different methods entirely.
- The event-loop offender was `readFileSync` in `/api/[name].ts`.
- Bind-mount topology already routed uploads to the Caddy-served
  directory; only the atomic-write hardening was needed app-side.
- `design-v2` holds per-site theme bundles (e.g.
  `skyclimber.bundle.json`, `assets/img/alpinisms/*.jpeg`), rsynced
  onto the droplet during provisioning — not uploaded through the
  admin UI.

---

## Tier 2 — on-demand ISR

### Landed

- **New endpoint `ui/client/pages/api/revalidate.ts`.** POST accepts
  one of:
  - `{scope: 'all'}` — resolves nav + published posts via GraphQL and
    revalidates `/`, `/blog`, every `/<page-slug>`, every published
    `/blog/<slug>`.
  - `{scope: 'page', pageName}` — single page (Home → `/`).
  - `{scope: 'post', slug}` — `/blog` + `/blog/<slug>`.
  - `{scope: 'blog'}` — `/blog` only.
  - `{paths: string[]}` — escape hatch.

- **Auth model: NextAuth session cookie (editor+).** No shared secret
  in the client bundle. Optional `REVALIDATE_TOKEN` env var retained
  for machine-to-machine callers (import scripts, cron).

- **`REVALIDATE_MAX` env cap** (default 200) so a large site can't be
  forced into a mass-regen storm.

- **Slug helper `shared/utils/pagePath.ts`.** Centralises the
  `"About Us" → "/about-us"` transform so the revalidate endpoint,
  `[...slug].tsx` and the sitemap generator produce identical paths.

- **Client helper `ui/client/lib/triggerRevalidate.ts`.** Fire-and-
  forget `fetch` to `/api/revalidate`. Same-origin credentials; no
  token visible to the browser.

- **Wired into every mutating admin flow** (scope choice in each):
  | API wrapper | Mutation | Scope |
  |---|---|---|
  | `ThemeApi` | `saveTheme`, `deleteTheme`, `resetPreset`, `setActive` | `all` |
  | `FooterApi` | `save` | `all` |
  | `SiteFlagsApi` | `save` | `all` |
  | `SiteSeoApi` | `save` | `all` |
  | `NavigationApi` | create / rename / reorder / delete | `all` |
  | `SectionApi` | `addSectionToPage`, `addRemoveSectionItem` | `page` (falls back to `all` if no pageName on payload) |
  | `SectionApi` | `deleteSection` | `all` (section id alone doesn't name the page) |
  | `PostApi` | `save` | `post` |
  | `PostApi` | `remove`, `setPublished` | `blog` (index only — old slug unknown) |

- **ISR window bumped** 60 s → 3600 s on all four public entrypoints
  (`ui/client/pages/index.tsx`, `[...slug].tsx`, `blog/index.tsx`,
  `blog/[slug].tsx`). On-demand hook now owns freshness; background
  ISR just backstops against missed webhooks.

---

## Tier 3 — presence polling

### Landed

- **`POLL_MS` 15 s → 45 s** (`PresenceBar.tsx`). Cuts traffic from
  8/min → 1.3/min per admin tab.
- **TTL 45 s → 90 s** (`PresenceService.ts`). 2× poll interval so a
  single missed tick doesn't blink peers out. `ensureIndexes` now
  issues a `collMod` to update the TTL in place on existing
  deployments (Mongo doesn't accept TTL changes via `createIndex`).
- **Server-side heartbeat debounce** (`HEARTBEAT_DEBOUNCE_MS = 10_000`).
  Conditional upsert `{email, docId, at: {$lt: cutoff}}` — skips the
  write when an existing row is still within the debounce window.
  Atomic via Mongo's single-filter update; no race.
- **Heartbeat + list collapsed into one endpoint.** POST to
  `/api/presence` now returns `{ok, entries}`; client drops the
  separate GET. Halves rate-limit budget consumption per tick.
- **`document.hidden` pause.** The tick function no-ops while the tab
  is backgrounded; `visibilitychange` triggers an immediate resume
  tick instead of waiting up to 45 s.

---

## Tier 4 — deployment hardening

### Landed

- **`app` healthcheck** (`infra/compose.yaml`). `wget --spider http://localhost:80/`
  every 15 s, 90 s start period. Next reports healthy after the first
  static-gen cycle.
- **Zero-downtime rebuild** (`.github/workflows/ci.yml`).
  `docker compose up --no-deps --build -d app` — mongodb / server /
  caddy stay running untouched; TLS doesn't blip; DB pool survives.
- **Real health wait.** Replaced `sleep 15` with a 3-minute polling
  loop on `docker inspect front` state; dumps `docker logs --tail=200`
  and fails the job on timeout.
- **Public-domain smoke check.** `curl -o /dev/null -w "%{http_code}"
  https://funisimo.pro/` after health — catches TLS / reverse-proxy
  regressions in addition to app health. Fails the deploy on non-200.
- **BuildKit enabled** via `DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1`
  so layer cache on the droplet accelerates incremental rebuilds.
- **Deploy target confirmed as `funisimo.pro` only.**
  `DEPLOY_HOST_2` / `DEPLOY_ENV_FILE_2` secrets untouched; a comment
  at the top of the deploy job documents the switch path for when
  skyclimber.pro comes online.

### Seamless deployment (downtime bridging)

User's target: zero downtime, or a branded "under maintenance" page
instead of raw 502s during the container swap.

- **Caddy retry bridge** — `reverse_proxy app:80 { lb_try_duration 30s
  lb_try_interval 500ms fail_duration 0s }`. Caddy holds incoming
  requests for up to 30 s while retrying the upstream — invisible
  bridge across quick container swaps.
- **Maintenance page** — static `infra/maintenance/index.html` mounted
  read-only into Caddy at `/srv/maintenance`. Caddy's `handle_errors`
  block serves it on 502/503/504, with `<meta refresh="15">` so the
  browser bounces back to the real site as soon as the new container
  answers. Branded dark page with a spinner + apology copy.
- **Upstream error normalisation** — Next.js 502/503/504 responses are
  caught by the reverse_proxy's `handle_response @bad` and re-thrown
  as `error 502` so they flow into the same `handle_errors` block as
  connection refusals.
- **Fixed the post-refactor compose-path drift** — CI was calling
  `docker compose -f compose.yaml` but the `refactoring` commit
  (d0410b1) had moved compose to `infra/compose.yaml`. Deploys have
  been failing silently since then on new droplets. Now calls
  `docker compose -f infra/compose.yaml` and compose binds use `../`
  for paths shared with the repo root (mongo_data, uploads) and
  `./` for paths co-located in `infra/` (Caddyfile, maintenance).

### Deferred (would need extra infra)

- Pushing built images to GHCR + `docker compose pull` on the droplet.
  Would swap the SSH-build model for a registry-pull model and cut
  deploy time from ~3 min to ~30 s; larger change than this session's
  scope. See `docs/roadmap/production/seamless-deployment.md` for the
  recommended plan.
- GHA `cache-from/to=type=gha` for buildx. Only applies when the build
  runs inside GHA, not over SSH on the droplet.

---

## Tier 5 — deferred

- CDN in front of Caddy.
- Per-PR preview deployments.

---

## Env vars introduced

| Name | Purpose | Required? |
|------|---------|-----------|
| `REVALIDATE_TOKEN` | Shared secret for non-browser callers of `/api/revalidate` | Optional — session auth covers admin browser calls |
| `REVALIDATE_MAX` | Cap on paths revalidated per request (default 200) | Optional |
| `SMOKE_URL` | CI deploy smoke-check target (defaults to `https://funisimo.pro/`) | Optional |

## Files touched this session

- `services/features/Assets/imageOptimize.ts`
- `services/features/Presence/PresenceService.ts`
- `services/api/client/ThemeApi.ts`
- `services/api/client/NavigationApi.ts`
- `services/api/client/SectionApi.ts`
- `services/api/client/PostApi.ts`
- `services/api/client/FooterApi.ts`
- `services/api/client/SiteFlagsApi.ts`
- `services/api/client/SiteSeoApi.ts`
- `shared/utils/pagePath.ts` _(new)_
- `ui/client/pages/api/revalidate.ts` _(new)_
- `ui/client/pages/api/presence.ts`
- `ui/client/lib/triggerRevalidate.ts` _(new)_
- `ui/client/features/Presence/PresenceBar.tsx`
- `ui/client/pages/index.tsx`
- `ui/client/pages/[...slug].tsx`
- `ui/client/pages/blog/index.tsx`
- `ui/client/pages/blog/[slug].tsx`
- `infra/compose.yaml`
- `infra/Caddyfile`
- `.github/workflows/ci.yml`
- `tools/scripts/server-init.sh`
- `ui/client/pages/api/[name].ts` _(deleted)_
- `ui/client/pages/api/media/[...path].ts` _(deleted)_
