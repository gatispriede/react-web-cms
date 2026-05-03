# Seamless deployment (zero-downtime)

**Status:** Shipped (2026-05-03). Runbook: [docs/runbooks/seamless-deployment.md](../../runbooks/seamless-deployment.md).

## Problem (recap)

P2 deploy flow does a stop-the-world restart of the `app` container.
During the rebuild + boot window (15–60 s) Caddy returns 502s (mitigated
in production by the maintenance page + 30 s `lb_try_duration` retry
budget already in the Caddyfile, but visitors still see a delayed page).

## Approach (shipped)

**Blue/green with Caddy upstream switch — option B from the original
plan.** Option A (CI-built image pushed to GHCR) is still on the table
as a future optimization, but it doesn't by itself eliminate the cutover
moment — only blue/green does. The two are complementary.

## Implementation

- **`infra/compose.yaml`** — added `app-blue` + `app-green` services
  under the `seamless` Compose profile (off by default; opted into by
  `docker compose --profile seamless ...`). Both mirror `app` exactly,
  share the same Mongo/uploads/secrets volumes. `IS_LEADER=1` only on
  blue so boot-once code (font cache warm, scheduled task registration)
  doesn't double-fire.
- **`infra/Caddyfile`** — `reverse_proxy` now uses `{$ACTIVE_UPSTREAM:app:80}`.
  Default `app:80` keeps the legacy single-instance path working; in
  production it's set to `app-blue:80` or `app-green:80` and rewritten
  by the deploy script.
- **`tools/blue-green-deploy.sh`** — runs on the droplet during deploy.
  Builds + starts the inactive side, polls its `/api/health` directly
  via `docker exec`, verifies the running container's git SHA matches
  the target commit (security gate), then rewrites `ACTIVE_UPSTREAM` in
  `.env` and `docker compose up -d --no-deps caddy` for a graceful
  reload. Drains for `DRAIN_SECONDS` (default 30 s) before declaring
  the deploy complete.
- **`.github/workflows/deploy.yml`** — gated by `vars.SEAMLESS_DEPLOY`
  (off by default). When set, calls the blue/green script over SSH;
  otherwise falls through to the legacy P2 path. Post-flip, also
  verifies `/api/health` from outside the droplet.

## Boot-leader strategy

Env flag (`IS_LEADER=1` on blue) NOT a Redis lock. Reasoning in the
runbook — TL;DR: one less moving part, deterministic at boot, blue is
canonically the default-active side anyway.

## Acceptance

- Deploy completes with no public 502s (Caddy keeps serving old upstream
  until reload).
- Rollback flips `ACTIVE_UPSTREAM` back in `<5 s` (no rebuild needed —
  the previous instance is still running its old image).
- Dev path (`npm run dev`, single-instance docker) unaffected.
- Failed health check on the inactive side aborts WITHOUT flipping.
- Commit-SHA verification refuses the flip if the running container
  doesn't match the target commit.

## Effort (actual)

**S–M · ~3 h** — Caddyfile env switch + compose profile + orchestration
script + workflow gate + runbook. No new dependencies, no app-code
changes (boot-once code already keys on env, so adding `IS_LEADER`
plumbing is the only follow-up if any module currently runs unguarded
boot work).
