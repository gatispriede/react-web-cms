# Seamless (blue/green) deployment runbook

> **Wave 1 Terraform/Kamal note (2026-05-08):** funisimo is migrating to
> Kamal-driven deploys — see [`kamal-deploy.md`](kamal-deploy.md). This
> runbook stays accurate for skyclimber until its cutover lands. The
> legacy script moved to `tools/legacy/blue-green-deploy.sh` to signal
> retirement is in progress.

P4 closes the brief outage window from P2 by running two app containers
behind Caddy and swapping the upstream marker on each deploy. Old container
keeps serving until the new one is healthy; Caddy reload is graceful, so
in-flight requests finish on the old upstream while new requests land on
the new one.

## Architecture

```
                                          (env-driven)
                                       ACTIVE_UPSTREAM=app-blue:80
                                                |
                            +------------+------v----------+
   public --> Caddy (:443) -+   reverse_proxy {ACTIVE_UPSTREAM}
                            +------------+------+----------+
                                         |      |
                                  app-blue   app-green
                                  (active)   (idle, ready for next deploy)
                                       \      /
                                        Mongo + uploads (shared volumes)
```

- Both containers share Mongo, uploads, secrets — they're literally two
  PIDs of the same app pointed at the same data.
- `IS_LEADER=1` on `app-blue` only. Boot-once code (font cache warm,
  scheduled task registration, restart-required marker reset) keys on
  this env; `app-green` skips it. **Trade-off:** if blue is down, no one
  runs boot-once code until blue boots again. Acceptable because boot-once
  code is idempotent.
- Why env flag and not a Redis lock: one less moving part, no lease
  renewal, no split-brain window, and blue is canonically the "default
  active" (Caddyfile fallback `app-blue:80`) so the leader is always
  identifiable at boot.

## One-time droplet provisioning

```bash
# 1. Pull the new compose definitions.
cd /opt/cms && git pull

# 2. Bring up both blue + green (the `seamless` profile gates them).
docker compose --profile seamless -f infra/compose.yaml up -d \
  app-blue app-green

# 3. Set the initial upstream marker in /opt/cms/.env.
echo 'ACTIVE_UPSTREAM=app-blue:80' >> /opt/cms/.env

# 4. Reload Caddy to pick up the env.
docker compose -f infra/compose.yaml up -d --no-deps caddy

# 5. Confirm both instances respond (one via Caddy, both via docker exec).
curl -fsS https://$DOMAIN/api/health
docker exec app-blue  wget -qO- http://localhost:80/api/health
docker exec app-green wget -qO- http://localhost:80/api/health

# 6. Flip the GitHub repository variable to enable seamless deploys.
#    Settings -> Variables -> Actions -> add SEAMLESS_DEPLOY=1
```

After that, every push to `master` runs `tools/blue-green-deploy.sh` on
the droplet via SSH. Default off keeps the legacy P2 path live until step 6.

## Per-deploy flow

`.github/workflows/deploy.yml` -> SSH -> `tools/blue-green-deploy.sh`:

1. Read `ACTIVE_UPSTREAM` from `.env`. Pick the OTHER side as the target.
2. `git checkout <TARGET_SHA>`; verify `git rev-parse HEAD` matches.
3. `docker compose --profile seamless build <target-side>`.
4. `docker compose --profile seamless up -d --no-deps <target-side>`.
5. Poll `docker exec <target-side> wget /api/health` for up to
   `DEPLOY_HEALTH_TIMEOUT` (default 60s).
6. Verify the running container reports the expected commit (security
   gate against poisoned working trees / racing edits on the droplet).
7. Rewrite `ACTIVE_UPSTREAM=<target-side>:80` in `.env`.
8. `docker compose up -d --no-deps caddy` (graceful reload, drains
   in-flight on the old side).
9. Sleep `DRAIN_SECONDS` (default 30s) so the now-idle side quiesces.
10. Workflow confirms public `/api/health` is 200 from outside the droplet.

If steps 5/6 fail, the script aborts WITHOUT flipping. Caddy keeps
serving the old (still-healthy) upstream and the workflow exits non-zero.

## Manual rollback

The just-replaced instance still runs the previous build until the next
deploy overwrites it. Flip back instantly:

```bash
ssh deploy@$HOST
sed -i 's|^ACTIVE_UPSTREAM=.*|ACTIVE_UPSTREAM=app-blue:80|' /opt/cms/.env
docker compose -f /opt/cms/infra/compose.yaml up -d --no-deps caddy
```

(Swap `app-blue:80` for whichever side was previously active.)

## Tuning

| Var | Default | What it controls |
|---|---|---|
| `SEAMLESS_DEPLOY` | unset | Repo var — set to `1` to use blue/green path |
| `DEPLOY_HEALTH_TIMEOUT` | 60 | Seconds to wait for inactive `/api/health` |
| `DRAIN_SECONDS` | 30 | Seconds to wait after Caddy flip before considering deploy done |
| `ACTIVE_UPSTREAM` | `app:80` | Caddyfile env; rewritten by the script |

## Health endpoint

`/api/health` returns `{status, bootId, uptimeMs, ...}` with HTTP 200 once
the Next.js process accepts requests. The blue/green script ALSO verifies
the inactive container's git SHA matches the target commit, so the
endpoint's shallowness (no Mongo/Redis ping) is acceptable for the flip
gate. If you later need richer readiness checks (Mongo connected, Redis
reachable), extend `ui/client/pages/api/health.ts` — the script picks it
up automatically.

## Dev impact

None. `npm run dev` and the legacy `docker compose up` path don't touch
the `seamless` profile, so `app-blue` and `app-green` aren't created. The
Caddyfile reverse_proxy default `{$ACTIVE_UPSTREAM:app:80}` falls back to
the original single-instance `app` service.
