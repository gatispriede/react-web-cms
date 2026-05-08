# Kamal — daily deploy + rollback + secrets

[Kamal 2](https://kamal-deploy.org/) replaces the 250-line inline ssh script in `.github/workflows/ci.yml` for funisimo (Wave 1 Terraform/Kamal migration). Skyclimber stays on the legacy bash deploy path until funisimo runs stable on Kamal for ≥ 1 release cycle.

**Status:** funisimo configured, pending cutover. Cutover gate is operator authorisation + a green test deploy against a fresh terraform-provisioned droplet.

## Mental model

The legacy deploy was: GHA → ssh into droplet → rsync sources → `docker compose up -d --build`. The whole thing was wedged into a stringly-typed shell script that could only be tested by running a real deploy.

Kamal replaces that with:

1. **CI builds** the image (`infra/AppDockerfile`) in `ghcr-push:` job → pushes `ghcr.io/gatispriede/cms:<sha>` to GHCR.
2. **CI runs `kamal deploy --destination=funisimo`** → Kamal SSH-connects to the droplet, pulls the image, runs a new container on the `cms_back-end` docker network alongside the legacy `front`, health-checks the new container.
3. **Operator flips Caddy upstream** by editing `/opt/cms/.env` → `ACTIVE_UPSTREAM=cms-web-<version>:80` and reloading Caddy. Drains gracefully in-flight requests on the legacy container.

**Operator decision 2026-05-08, option A**: kamal-proxy is **not used**. Caddy stays the public front (TLS termination, `/uploads/*`, `/design-v2/*`, MCP routing, SWR cache). Kamal handles image deploy + container swap only. Avoids the port-collision / extra-layer overhead of running kamal-proxy alongside Caddy on the same droplet.

The `proxy: false` line in `config/deploy.funisimo.yml` is what disables kamal-proxy; container is registered on `cms_back-end` via `servers.web.options.network`.

## Setup (operator, one-time per droplet)

```bash
# 1. Install kamal locally (Ruby gem)
gem install kamal -v '~> 2.0'

# 2. Get a GHCR token with read:packages for local kamal-deploy
#    runs (CI uses GITHUB_TOKEN with the repo's packages:write).
#    https://github.com/settings/tokens → Generate (classic) → read:packages
export GHCR_PAT=ghp_xxxxxxxxxxxx

# 3. Set the secrets Kamal will pipe into the running container.
#    These mirror what `DEPLOY_ENV_FILE_1` carries today.
export MONGODB_URI='mongodb://...'
export MCP_ALLOWED_CIDR='0.0.0.0/0'
export INITIAL_ADMIN_EMAIL='you@example.com'
export INITIAL_ADMIN_PASSWORD='...'

# 4. Bootstrap kamal-proxy on the droplet
kamal setup --destination=funisimo

# 5. First deploy
kamal deploy --destination=funisimo
```

Acceptance: `https://funisimo.pro/` serves the new commit within ~30 s (vs ~6-8 min on the legacy path). `kamal app logs --destination=funisimo --follow` tails the running container.

## Daily ops

| Goal | Command |
|------|---------|
| Deploy current HEAD | `kamal deploy --destination=funisimo` |
| Deploy a specific commit | `kamal deploy --destination=funisimo --version=<sha>` |
| Roll back one deploy | `kamal rollback --destination=funisimo` |
| Tail logs | `kamal app logs --destination=funisimo --follow` (alias: `kamal logs`) |
| Open node REPL in container | `kamal console --destination=funisimo` |
| Open shell in container | `kamal shell --destination=funisimo` |
| Restart the container | `kamal app boot --destination=funisimo` |
| Stop serving (drain) | `kamal app stop --destination=funisimo` |

`--destination=` repeats are tedious. Set a per-shell default:

```bash
export KAMAL_DESTINATION=funisimo
```

## Rollback

`kamal rollback` flips kamal-proxy back to the previous slot — instant, no rebuild needed. The previous container is still on the droplet (Kamal keeps the last 5 by default), so the rollback is just an upstream switch.

```bash
kamal rollback --destination=funisimo
# Verify
curl -sf https://funisimo.pro/api/healthz | head -1
```

If the rollback target is older than 5 deploys back, `kamal deploy --version=<older-sha>` fetches it from GHCR (until image-retention prunes it — keep-last-10 policy).

## Cutover from legacy bash deploy

Test deploy 2026-05-08 (option A path) validated the foundations:
terraform plan converges clean, image builds end-to-end, GHCR push +
droplet pull work, container boots in ~500 ms on the droplet,
`/api/health` + `/admin` + GraphQL all respond against the test
container. The cutover sequence below is what flips public traffic:

1. **GHCR push lands first** — `ghcr-push:` CI job (or local
   `docker push`) pushes images on every master push.
2. **Kamal deploy** — `kamal deploy --destination=funisimo` boots a
   new container on `cms_back-end`. Legacy `front` keeps serving.
3. **Caddy upstream flip** — on the droplet:
   ```bash
   ssh root@funisimo.pro
   # Look up the new container name (kamal v2 names them
   # `cms-web-<version>` where version = git SHA-7 prefix).
   NEW=$(docker ps --filter name=cms-web --format '{{.Names}}' | head -1)
   sed -i "s|^ACTIVE_UPSTREAM=.*|ACTIVE_UPSTREAM=${NEW}:80|" /opt/cms/.env
   docker compose -f /opt/cms/infra/compose.yaml up -d --no-deps caddy
   ```
4. **Smoke** — `curl -sf https://funisimo.pro/api/health` from your
   workstation. If 200, the cutover succeeded.
5. **One release cycle stable** — leave funisimo on Kamal for ≥ 7 days,
   monitor Errors panel + smoke checks. Skyclimber stays on the legacy
   path.
6. **Skyclimber cutover** — copy `config/deploy.funisimo.yml` to
   `config/deploy.skyclimber.yml`, swap hosts + secrets, repeat 1-5.
7. **Retire legacy** — delete `tools/legacy/blue-green-deploy.sh`, the
   `deploy:` matrix in `ci.yml`, the `app-blue` / `app-green` compose
   services, the `front` compose service, and the `DEPLOY_ENV_FILE_*`
   secrets.

**Rollback**: re-run step 3 with `ACTIVE_UPSTREAM=front:80`. The legacy
`front` container stays running throughout — flipping back is one `sed`
+ Caddy reload, no rebuild needed.

## Secrets

Kamal reads runtime secrets from the host env at deploy time — set them in CI (`secrets.SECRET_NAME` → `env: SECRET_NAME: ${{ secrets.SECRET_NAME }}`) and they get forwarded to the droplet via Kamal's secret-piping. Never commit them, never bake them into the image.

The `config/deploy.funisimo.yml` `env.secret:` list is what Kamal expects from the host at deploy time:

- `MONGODB_URI`
- `MCP_ALLOWED_CIDR`
- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD`
- `GHCR_PAT` (registry pull)

Adding a new secret: append to `env.secret:` in the deploy YAML, set the GHA secret, reference it in the `env:` block of the `kamal-deploy:` workflow step.

## Common failure modes

### `kamal deploy` hangs on healthcheck

The `/api/healthz` endpoint returns 503 until the app finishes loading the schema + connecting to mongo. Cold-start budget is ~30 s after the multi-stage prebuilt image lands; the deploy YAML allows 60 × 2s = 2 min before failing. If healthchecks consistently exceed that:

```bash
kamal app logs --destination=funisimo --lines=200
```

Common causes: missing `MONGODB_URI` secret, mongo unreachable, `next start` couldn't find `.next/` (multi-stage build issue — check `infra/AppDockerfile`).

### `kamal deploy` fails to pull image

Means GHCR auth is broken. Check `GHCR_PAT` is set + has `read:packages` scope.

### Caddy returns 502

Caddy is reverse-proxying to `kamal-proxy:8080` but kamal-proxy isn't running. Check `kamal app details --destination=funisimo` for the proxy state.

## Related

- [`docs/runbooks/terraform.md`](terraform.md) — provision the droplet that Kamal deploys to.
- [`docs/runbooks/ghcr.md`](ghcr.md) — the image registry Kamal pulls from.
- [`config/deploy.funisimo.yml`](../../config/deploy.funisimo.yml) — Kamal config file with inline notes on every block.
