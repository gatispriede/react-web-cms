# Automatic deployment

> **Wave 1 Terraform/Kamal note (2026-05-08):** the SSH+rsync+`docker
> compose up --build` flow this runbook describes is being replaced by
> [`kamal-deploy.md`](kamal-deploy.md) on funisimo. Skyclimber stays on
> this path until the migration's per-tenant cutover lands. CI now also
> pushes images to GHCR — see [`ghcr.md`](ghcr.md).

P2 of the production-ops roadmap. Push to `master` → built, tested,
SSH-deployed to the droplet, health-gated with rollback.

The workflow lives at `.github/workflows/deploy.yml`. It is **gated
by `vars.DEPLOY_ENABLED`** so wiring secrets does NOT trigger a live
deploy until the operator flips the toggle.

## One-time setup

### 1. Generate a deploy SSH key (laptop, do not commit)

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/cms-deploy-key -N ""
```

That produces `cms-deploy-key` (private) and `cms-deploy-key.pub`
(public).

### 2. Add the public key to the droplet's deploy user

The deploy user must have **no sudo** — it only needs to run `git`
and `docker compose` in `/opt/cms`. Create one if you don't already
have it:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo '<paste cms-deploy-key.pub contents>' \
    | sudo tee -a /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys

# Repo ownership: deploy user must be able to git pull + docker build.
sudo chown -R deploy:deploy /opt/cms
```

Verify from your laptop:

```bash
ssh -i ~/cms-deploy-key deploy@<droplet-ip> 'whoami && cd /opt/cms && git status'
```

### 3. GitHub repository secrets + variables

Settings → Secrets and variables → Actions:

**Secrets** (sensitive, encrypted):

| Name              | Value                                          |
|-------------------|------------------------------------------------|
| `DEPLOY_HOST`     | droplet IP or hostname                         |
| `DEPLOY_USER`     | `deploy`                                       |
| `DEPLOY_SSH_KEY`  | full contents of `~/cms-deploy-key` (private)  |
| `SITE_URL`        | e.g. `https://example.com`                     |

**Variables** (visible, unencrypted):

| Name              | Value           |
|-------------------|-----------------|
| `DEPLOY_ENABLED`  | `true`          |

Until `DEPLOY_ENABLED=true`, the build + test job runs on every push
to master but the deploy job is skipped — safe for staging the secrets.

### 4. Enable + test

Push a no-op change to master and watch the Actions tab. First deploy
takes ~3 minutes (build) + ~30 seconds (deploy + health check).

## Rollback

The workflow rolls back automatically if `/api/health` doesn't return
200 within 60 seconds. Manual rollback for a deploy that broke
something subtler:

```bash
ssh deploy@<droplet> 'cd /opt/cms && git log --oneline -5'
ssh deploy@<droplet> 'cd /opt/cms && git reset --hard <previous-sha> \
    && docker compose -f infra/compose.yaml up -d --no-deps app server'
```

## Debugging a stuck deploy

- **`Permission denied (publickey)`** — wrong key in `DEPLOY_SSH_KEY`,
  or the droplet rejected it. SSH in manually with the same key file
  to bisect.
- **`docker: permission denied`** — `deploy` user not in the `docker`
  group; re-run `sudo usermod -aG docker deploy` and re-login the
  user (or restart the SSH session).
- **`curl /api/health` times out** — the app container booted but
  Mongo refused auth. Check `docker logs front` (the app container
  is named `front` — historical reasons) for `MongoServerError:
  Authentication failed`. Usually means `MONGO_USER`/`MONGO_PASS` in
  `.env` got out of sync with the actual Mongo user — see
  [mongo-auth-setup.md](mongo-auth-setup.md) §rotation.
- **Repeated rollbacks** — the health check is a hard gate. If
  `/api/health` is flaky for a reason unrelated to the deploy, the
  workflow will look like every deploy fails. Check Cloudflare /
  upstream firewall rules; verify the `SITE_URL` secret matches the
  domain Caddy is actually serving.

## What this workflow intentionally does NOT do

- **No image registry push.** The droplet rebuilds locally from
  `git pull`. Faster CI, less moving parts; switch to GHCR later if
  the droplet's CPU becomes the bottleneck.
- **No DB migration runner.** Schema changes still need a manual
  `npm run …` on the droplet. Migrations are rare enough that
  automating them today would be overfitting.
- **No zero-downtime swap.** P4 (seamless deployment) is the next
  roadmap item; until then expect a ~5–15s maintenance-page window
  per deploy. Caddy's `lb_try_duration 30s` (already in the Caddyfile)
  bridges most of that for users mid-request.

## Security posture

- Deploy key is **ed25519** (smaller than RSA, modern, stronger).
- Deploy user has **no sudo**; the worst a stolen key can do is
  bounce app containers in `/opt/cms`.
- Workflow uses `concurrency: deploy-prod` with
  `cancel-in-progress: false` so two deploys can't race.
- The `production` GitHub environment lets you add required
  reviewers later without code changes.
