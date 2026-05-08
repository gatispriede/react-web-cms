# Kamal — daily deploy + rollback + secrets

[Kamal 2](https://kamal-deploy.org/) replaces the 250-line inline ssh script in `.github/workflows/ci.yml` for funisimo (Wave 1 Terraform/Kamal migration). Skyclimber stays on the legacy bash deploy path until funisimo runs stable on Kamal for ≥ 1 release cycle.

**Status:** funisimo configured, pending cutover. Cutover gate is operator authorisation + a green test deploy against a fresh terraform-provisioned droplet.

## Mental model

The legacy deploy was: GHA → ssh into droplet → rsync sources → `docker compose up -d --build`. The whole thing was wedged into a stringly-typed shell script that could only be tested by running a real deploy.

Kamal replaces that with:

1. **CI builds** the image (`infra/AppDockerfile`) in `ghcr-push:` job → pushes `ghcr.io/gatispriede/cms:<sha>` to GHCR.
2. **CI runs `kamal deploy --destination=funisimo`** → Kamal SSH-connects to the droplet, pulls the image, runs the new container alongside the old, health-checks, flips kamal-proxy upstream, drains the old container.

Caddy stays in front (TLS, `/uploads/*`, MCP path proxying); kamal-proxy sits behind Caddy on port 8080 and handles the blue-green slot logic Kamal owns.

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

The migration spec runs Kamal alongside the legacy ssh deploy during the cutover window:

1. **GHCR push lands first** — the `ghcr-push:` CI job pushes images on every master push, but no droplet pulls them yet.
2. **Kamal setup against a fresh test droplet** — provision via `terraform/environments/<test>` (or just a temp droplet), `kamal setup`, `kamal deploy`. Verify deploy timing + healthcheck behaviour.
3. **Kamal cutover on funisimo** — flip `ACTIVE_UPSTREAM` in funisimo's `.env` from `app:80` to `kamal-proxy:8080`. Run `kamal deploy --destination=funisimo`. Verify the public smoke URL.
4. **One release cycle stable** — leave funisimo on Kamal for ≥ 7 days, monitor Errors panel + smoke checks. Skyclimber stays on the legacy path.
5. **Skyclimber cutover** — repeat steps 3-4 for skyclimber.
6. **Retire legacy** — delete `tools/legacy/blue-green-deploy.sh`, the `deploy:` matrix in `ci.yml`, the `app-blue` / `app-green` compose services, and the `DEPLOY_ENV_FILE_*` secrets.

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
