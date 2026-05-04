# Server restart from UI

Status: **Shipped 2026-05-02.** Backend (registry, service, GraphQL, `/api/health`, FeatureFlags wiring) + admin UI banner + restart button + confirm modal + bootId-poll-and-reload flow. Dev-mode fallback ("not under a supervisor — restart manually") wired.
Last updated: 2026-05-02

## Why

Plug-and-play v2 has a sharp edge: flipping a boot-disabled feature on through the admin UI takes effect at the runtime gate level (route 404s clear, `isFeatureEnabled` flips), but the underlying services aren't constructed, the SDL isn't composed, and the resolvers aren't bound until the server restarts. Until v3 ships (true hot-reload via Apollo gateway / federation primitives — non-trivial), the operator's only recourse is shell access.

A one-click **Restart server** button from `/admin/system/features` closes the loop without paying the v3 complexity cost. The supervisor (systemd, pm2, Docker `--restart=always`, DigitalOcean App Platform) handles the re-spawn; we just signal a graceful shutdown.

Same primitive solves other boot-bound config flips:

- **Default locale switch** — `next-i18next` / `next.config.js` i18n config is loaded at boot. Changing the default locale needs the SSR/SSG layer to re-read the fallback chain and re-prerender static pages.
- **Theme defaults at the framework level**, env-derived feature toggles flipped via `.env` edits, and any future config that lands in `next.config.js` or module-load-time singletons.

Generalise the affordance: the button isn't "restart for feature flags", it's "restart to apply boot-time config". Each caller (feature flags, locale settings, etc.) registers a `requiresRestart` reason that the banner aggregates ("Restart required for: feature flags, default locale").

## Goals

- Operator flips a feature flag → sees a "Restart required to fully activate" banner → clicks one button → server cycles → admin page auto-reloads when the new process is healthy.
- Graceful: in-flight requests drain (Apollo `stop()`, HTTP server `close()`), then process exits cleanly.
- Detect supervised vs unsupervised environments. In dev (`next dev`) the button is replaced with "Run `npm run dev` again" copy — no kill signal.
- Admin-only. Audit-logged. Rate-limited (one restart per 30s) so a malicious or buggy client can't loop the server.

## Sketch

### Detection

Env var `SERVER_SUPERVISED=true` (set in production deploys, Dockerfile, App Platform spec). When unset, the UI shows a manual-restart hint instead of the button. A second env var `SERVER_RESTART_ENABLED=true` gates the feature on/off entirely (defense in depth — operator can opt out).

### Endpoints

| Operation | Scope | Purpose |
|---|---|---|
| `mongo.requestServerRestart: String!` | admin | Audit-logged, rate-limited, schedules graceful shutdown after a short delay (~500ms so the response can flush) |
| `GET /api/health` | public | Returns `{status: "ok", bootId, uptimeMs}` — used by the admin UI to detect "the server is back, and it's a different process" via `bootId` change |

`bootId` = a UUID generated at module load. Same process → same id. Restart → new id.

### Restart-reason registry

A small in-memory registry (`services/infra/restartRequired.ts`) tracks pending boot-time changes. Anything that mutates boot-bound config calls `markRestartRequired({source, reason, since})`. The admin UI reads it via `mongo.getRestartStatus` and surfaces a global banner (visible across all admin pages, not just features) listing every pending reason. Cleared on successful restart.

Initial sources:
- `feature-flags` — boot-disabled feature toggled on.
- `i18n` — default locale changed, locale list edited.
- *(extensible)* — future config goes here without UI changes.

### UI flow

1. Global admin banner shows when the restart-reason registry has entries. Wording aggregates reasons: *"Restart required to apply: feature flags, default locale."* + `Restart server` button.
2. `FeatureFlagsPanel.tsx` and the i18n settings page each show an inline echo of the same banner so the operator sees the cause near the trigger.
2. Click → confirmation modal listing what will reappear (services, GraphQL fields, MCP tools).
3. Confirm → call `requestServerRestart` → poll `/api/health` every 1s.
4. While polling: spinner + "Restarting…" copy. First few polls 503 (process gone) — handled silently.
5. New `bootId` detected → toast "Server restarted" → `window.location.reload()`.
6. Timeout after 60s → error toast + manual instructions.

### Graceful shutdown

```
async function gracefulShutdown() {
  log.info('shutdown.requested', {actor});
  apolloServer.stop();           // stop accepting new ops
  await drainExistingRequests(); // ~5s ceiling
  await mongoClient.close();
  process.exit(0);                // supervisor respawns
}
```

`drainExistingRequests()` = `httpServer.close()` + a hard timeout. Anything still mid-flight at the timeout gets dropped — the supervisor will spawn a fresh process; clients retry.

### Audit

Every restart goes through `runMutation` like other admin writes, stamped `{actor, reason: "feature flag activation" | "manual"}`. Visible on the audit log page.

### Rate limit

In-memory token bucket: 1 restart / 30s, hard. Second click within window gets a `429`-ish error in the modal.

## Out of scope

- **Zero-downtime / multi-instance** — that's [`seamless-deployment.md`](../../roadmap/production/seamless-deployment.md). This feature assumes single-instance and accepts a ~3-5s gap.
- **Hot module replacement** — true v3 hot-reload of services/schema/resolvers without bouncing the process. Still deferred; needs Apollo gateway/federation.
- **Scheduled restarts** — cron-like maintenance windows. Could come later; not required for the flag-flip use case.
- **Per-feature partial restart** — kills only the affected feature's services. Equivalent complexity to v3, defer.

## Open questions

1. **Where does `SERVER_SUPERVISED` get set in dev?** Likely unset, so the dev fallback ("re-run `npm run dev`") covers it. Document in README.
2. **Health-check `bootId` storage** — module-scope `const bootId = randomUUID()` is enough; no Mongo write needed.
3. **Should the banner appear *before* the operator commits a destructive flip?** Probably yes — pre-warn that "this change needs a restart" before the toggle, so they can batch flips and restart once.
4. **What about MCP-driven flips?** MCP `site.setFeatureFlag` should return `{requiresRestart: true}` in its payload so an AI agent can decide whether to call `site.restartServer` (new tool, scope `write:site:restart` or stricter).
5. **DigitalOcean App Platform** — `process.exit(0)` triggers a respawn within seconds; verify in staging before rolling to prod.
