# Seamless deployment (zero-downtime)

**Status:** Open.

## Problem

Current deploy flow: GitHub Actions SSH into the droplet → `git pull` → `docker compose up --build -d`. The `app` (Next.js) container rebuilds from scratch on every deploy — Next.js build runs inside the container at start time, taking 2–4 minutes on a 1–2 GB droplet. During that window Nginx gets 502s.

## Goal

Users on funisimo.pro see no downtime or degraded responses during a deploy.

## Options

### A — Pre-build image in CI, push to registry (recommended)

Build the Next.js image in GitHub Actions (fast runner, plenty of RAM), push to GitHub Container Registry (`ghcr.io`), then on the droplet just `docker pull` + `docker compose up -d` (no build step). The old container keeps serving until the new one is healthy.

- No build step on the droplet — deploy takes ~30 s instead of 3+ min.
- Requires `depends_on: service_healthy` already in place (✓).
- Add a `healthcheck` to the `app` service so Compose waits before cutting over.

### B — Blue/green with two app containers + Nginx upstream swap

Run two app containers (`app-blue`, `app-green`); deploy writes to the idle slot, then atomically rewrites the Nginx upstream. More complex, overkill for a single-server setup.

### C — Keep build on server but add a warm-up period

Build in a separate `docker compose build` step before `up`, so the old container keeps running during build. Less reliable — any build failure leaves the old image stale.

## Recommended approach (A)

1. **CI: build & push image**
   ```yaml
   - name: Build and push app image
     uses: docker/build-push-action@v5
     with:
       context: .
       file: AppDockerfile
       push: true
       tags: ghcr.io/${{ github.repository }}/app:latest
   ```

2. **compose.yaml: pull instead of build**
   ```yaml
   app:
     image: ghcr.io/gatispriede/react-web-cms/app:latest
     # remove: build: { context: ., dockerfile: AppDockerfile }
   ```

3. **App healthcheck** (add to compose.yaml):
   ```yaml
   healthcheck:
     test: curl -f http://localhost:80/ || exit 1
     interval: 15s
     retries: 5
     start_period: 30s
   ```

4. **Deploy step on droplet**: `docker compose pull && docker compose up -d`

## Files to touch

- `.github/workflows/deploy.yml` — add build/push step, pass `GHCR_TOKEN` secret.
- `compose.yaml` — swap `build:` for `image:` on `app` service; add `healthcheck`.
- `AppDockerfile` — no changes needed; build just moves to CI runner.

## Acceptance

- Deploy completes in < 60 s end-to-end.
- No 502s observed during deploy (Nginx continues serving old container until new one is healthy).
- Rollback: `docker compose pull ghcr.io/.../app:<prev-sha> && docker compose up -d`.

## Effort

**S · 2–3 h** — CI yaml change + compose tweak. The Dockerfile already works; this is purely plumbing.
