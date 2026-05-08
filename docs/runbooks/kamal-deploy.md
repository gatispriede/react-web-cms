# Kamal — funisimo.pro deploy runbook

Funisimo.pro is served by a [Kamal v2](https://kamal-deploy.org/)-managed `cms-web` container after the 2026-05-08 cutover. Skyclimber.pro stays on the legacy ssh+rsync deploy path until it has its own DigitalOcean API token and a parallel Kamal cutover.

**Architecture:** Caddy stays the public front (TLS, `/uploads/*`, `/design-v2/*`, `/mcp` routing, SWR cache). Kamal manages the app container only — `kamal app boot` pulls the GHCR image, swaps containers. CI rotates docker network aliases so Caddy's `cms-web:80` upstream resolves to the new container.

**Status:** Live since 2026-05-08. Deploys triggered automatically on every master push (`.github/workflows/ci.yml#deploy-funisimo`).

---

## Deploy flow on master push

```
master push
  ↓
test-and-typecheck  (vitest + tsc, ~2 min)
  ↓
ghcr-push:          (multi-stage Dockerfile build + push to GHCR, ~5-10 min)
  ↓
deploy-funisimo:    (kamal app boot + alias rotation + smoke, ~2 min)
  ↓
funisimo.pro serves the new image
```

Total master-push → live: **~10-15 min**, fully automated.

The legacy `deploy:` matrix in `ci.yml` is set `auto: false` for funisimo (stays on the matrix as an emergency fallback if Kamal needs backing out via `workflow_dispatch --target=funisimo.pro`). Skyclimber's `auto:` flag is also `false` since 2026-05-08 (operator paused — see commit `6e65790`).

---

## Why no kamal-proxy

Kamal v2 ships with its own reverse proxy (`kamal-proxy`) that wants ports 80/443. Caddy already binds those for the existing `/uploads/*`, MCP routing, and SWR cache. Running both would either fight for ports or require kamal-proxy on a non-default port (extra moving parts).

The migration spec's "option A" (operator decision 2026-05-08): **skip kamal-proxy**. Caddy continues as the public front; Kamal handles container lifecycle only. Disabled via `servers.web.proxy: false` in `config/deploy.yml` ([role.rb:168](https://github.com/basecamp/kamal/blob/main/lib/kamal/configuration/role.rb): `"only false means no proxy for non-primary roles"`). Without that flag, `kamal app boot` succeeds at `docker run` then fails registering the new container with `docker exec kamal-proxy …` and stops the just-booted container.

---

## Architecture quirks to know

### 1. `--network kamal` is hardcoded

Kamal v2.11 hardcodes `--network kamal` on the `docker run` for the app container ([app.rb:21](https://github.com/basecamp/kamal/blob/main/lib/kamal/commands/app.rb)). No `deploy.yml` override available.

CI's `Ensure 'kamal' docker network exists on funisimo` step pre-creates the network (idempotent). Real connectivity to mongo + caddy comes from a post-boot `docker network connect cms_back-end cms-web-<sha>` + `cms_front-end cms-web-<sha>`.

### 2. Container naming + alias rotation

Kamal names containers `cms-web-<full-sha>` (versioned). Caddy's upstream is `cms-web:80` (unversioned, set by the [2026-05-08 manual cutover](#)). Mismatch → Caddy can't find the new container.

CI's `Rotate to new container + public smoke` step solves this with a docker network alias:

```bash
NEW=$(docker ps --filter "name=cms-web-" --format "{{.Names}}" | head -1)
# Stop+remove all prior cms-web*
for c in $(docker ps -a --filter "name=cms-web" --format "{{.Names}}"); do
    [ "$c" != "$NEW" ] && docker rm -f "$c"
done
# Attach the new container with alias `cms-web` on both networks
docker network connect cms_back-end "$NEW" --alias cms-web
docker network connect cms_front-end "$NEW" --alias cms-web
```

Caddy resolves `cms-web:80` → whichever container currently holds the alias. Caddy's `lb_try_duration 30s` covers the brief gap during swap.

### 3. SSH host-key validation

Kamal uses Net::SSH 7.3 which validates host keys against `~/.ssh/known_hosts`. CI's ephemeral runner doesn't carry persistent known_hosts, and `ssh-keyscan -H`'s hashed entries don't match Net::SSH's compound-key lookup (`funisimo.pro,46.101.220.131`).

CI's `Configure SSH for funisimo.pro` step writes plain entries to `~/.ssh/config` with `StrictHostKeyChecking no` for funisimo + both its IPs. Auth still requires `DEPLOY_SSH_KEY` private key — strict host-key verification on an ephemeral GHA runner adds no real security.

### 4. Runtime env via `--env-file`

`config/deploy.yml#servers.web.options.env-file: /opt/cms/.env` points kamal at the existing on-droplet env file. No `env: secret:` block in deploy.yml because mirroring 9 secrets into GHA settings is friction we don't need — `/opt/cms/.env` is already the canonical store from the legacy compose stack.

To rotate a secret: edit `/opt/cms/.env` on the droplet, then push a master commit (or trigger a manual workflow_dispatch) — the next deploy recreates the container with the new env.

---

## Daily ops

| Goal | Command |
|------|---------|
| Deploy current master | Push to master (auto-deploys) |
| Re-deploy current SHA | Actions → "CI" → Run workflow on master |
| Deploy a specific SHA | Push that SHA to master, or manual `kamal app boot --version=<sha>` from a workstation with the right secrets |
| Tail logs | `ssh root@funisimo.pro 'docker logs -f cms-web-<sha>'` (or use the `cms-web` alias if you can identify the live container) |
| Open shell in container | `ssh root@funisimo.pro 'docker exec -it $(docker ps --filter name=cms-web- -q | head -1) sh'` |
| Restart container | `ssh root@funisimo.pro 'docker restart cms-web-<sha>'` |
| Check current version | `ssh root@funisimo.pro 'docker ps --filter name=cms-web- --format "{{.Image}}"'` |

---

## Rollback

The legacy `front` container is no longer running on funisimo (Kamal cutover removed it). To roll back:

### Option A — redeploy a previous SHA

Find a previous tag on GHCR (`docker pull ghcr.io/gatispriede/cms:<old-sha>`), then on the droplet:

```bash
ssh root@funisimo.pro
docker pull ghcr.io/gatispriede/cms:<old-sha>
NEW="cms-web-<old-sha>"
# Stop current
docker rm -f $(docker ps --filter "name=cms-web-" -q)
# Boot old version, attaching to networks with alias cms-web
docker run -d --name "$NEW" \
  --network kamal \
  --env-file /opt/cms/.env \
  -v /opt/cms/uploads:/srv/uploads \
  --restart unless-stopped \
  ghcr.io/gatispriede/cms:<old-sha>
docker network connect cms_back-end "$NEW" --alias cms-web
docker network connect cms_front-end "$NEW" --alias cms-web
```

GHCR retention is "keep last 8 versions" (`.github/workflows/ghcr-retention.yml`); rollback target SHA must be on the GHCR list.

### Option B — emergency `workflow_dispatch` legacy deploy

The legacy ssh+rsync deploy still works as a fallback. Actions tab → "CI" → Run workflow → set `target: funisimo.pro`. The matrix entry's `auto: false` keeps it off auto-master-push, but manual dispatch still resolves it.

---

## Failure modes (with fixes)

### `kamal app boot` fails with "Configuration file not found"

Kamal expects `config/deploy.yml`. Earlier iterations had `config/deploy.funisimo.yml` + a `--destination=funisimo` flag, but that requires a base `deploy.yml` that we don't have. Fix already in place: single-target setup uses `deploy.yml` directly.

### `network kamal not found`

CI's pre-create-network step didn't run. Re-run the failed jobs from the Actions tab.

### `Net::SSH::HostKeyMismatch`

CI's `Configure SSH for funisimo.pro` step didn't run, OR the funisimo droplet's host key changed. Re-run failed jobs first; if still failing, check the droplet hasn't been rebuilt.

### `Cannot find module '/app/node_modules/<pkg>/dist/<file>.mjs'`

Standalone-output trace gap. We're NOT on standalone right now (reverted 2026-05-08 — see commit `4a78e50`) so this shouldn't recur unless someone re-introduces `output: 'standalone'`. If they do, add the package's dist dir to `outputFileTracingIncludes` in `ui/client/next.config.js` AND validate via `infra/compose.local-prod-test.yaml` before pushing.

### Homepage shows marketing landing instead of real content

`/` was previously rendered via `getStaticProps + revalidate: 3600` which baked `showLanding=true` from the empty in-memory Mongo of `tools/docker-prebuild.js`. Fixed 2026-05-08 (commit `93e6066`) by switching to `getServerSideProps` — re-evaluates per request against runtime Mongo. If a similar bug recurs on a different page, the same fix pattern applies.

---

## Pre-deploy validation (do this before risky changes)

`infra/compose.local-prod-test.yaml` runs the production-built image locally against a seeded Mongo. Catches build-time-vs-runtime divergences that `npm run dev` masks.

```bash
# 1. Pull a fresh prod mongo dump (operator-only, gitignored)
ssh root@funisimo.pro 'docker exec mongodb mongodump --db DB --archive' \
  > infra/datasets/mongo-seed/dump.archive

# 2. Build the production image locally
docker build --file infra/AppDockerfile \
  --build-arg GIT_SHA=$(git rev-parse HEAD) \
  --tag cms:local-prod-test .

# 3. Bring up the test stack
docker compose -f infra/compose.local-prod-test.yaml up -d

# 4. Smoke against http://localhost:18080
curl -sf http://localhost:18080/api/health
curl -s http://localhost:18080/ | head -c 500   # verify real content, not landing

# 5. Tear down
docker compose -f infra/compose.local-prod-test.yaml down -v
```

If `/` shows landing markers ("MCP-native", "YOUR TEAM WRITES") instead of real content, the build is baking empty-Mongo state. Same bug that hit funisimo.pro 2026-05-08 with the standalone refactor — fix BEFORE pushing.

---

## Operator gates (one-time, already done)

The cutover is past these gates as of 2026-05-08, but if you're setting up a new tenant (e.g. skyclimber.pro), retrace this list.

1. **DigitalOcean PAT** stored in TF Cloud workspace var `do_token` (sensitive).
2. **TF Cloud workspace** `funisimo-prod` exists in org `funisimo`, CLI-driven workflow.
3. **GHCR Actions access** — package `gatispriede/cms` settings → "Manage Actions access" → repo `react-web-cms` with `Write` role. Without this, CI's `ghcr-push:` returns `403 Forbidden` on the first push.
4. **GHCR retention** — `keep last 8 versions` configured by `.github/workflows/ghcr-retention.yml` (weekly Mondays + manual).
5. **`kamal` docker network** pre-created on the droplet (idempotent CI step).
6. **`/opt/cms/.env`** carries the runtime env on the droplet — same file the legacy compose stack used.
7. **GitHub PAT scopes** on the operator's classic token: `repo`, `workflow`, `read:packages`, `write:packages`, `delete:packages`. Without `workflow` scope, pushes that touch `.github/workflows/*` get rejected.

---

## Related

- [`docs/runbooks/terraform.md`](terraform.md) — provision droplet that Kamal deploys to.
- [`docs/runbooks/ghcr.md`](ghcr.md) — image registry Kamal pulls from.
- [`docs/runbooks/local-prod-test.md`](local-prod-test.md) — pre-deploy validation flow.
- [`docs/runbooks/seamless-deployment.md`](seamless-deployment.md) — legacy bash deploy (still in use for skyclimber).
- [`config/deploy.yml`](../../config/deploy.yml) — Kamal config with inline notes on every block.
- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — `deploy-funisimo:` job.
