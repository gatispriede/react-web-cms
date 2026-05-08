# GHCR — image build, push, lifecycle

CI builds `infra/AppDockerfile` once per master commit and pushes `ghcr.io/gatispriede/cms:<sha>` + `:latest` to [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry). Wave 1 Terraform/Kamal migration — the prebuilt image is what eliminates the 6-8 min cold-deploy window the legacy bash deploy spent running `next build` inside the droplet's container.

## Why GHCR (not DO Container Registry / Docker Hub)

- **Free** for public + private repos at our scale (~1 GB/mo for keep-last-10 retention; well under the 50 GB free tier).
- **GHA-native auth** — `secrets.GITHUB_TOKEN` already has `packages: write` for the repo's own GHCR namespace. No extra secret to provision.
- **No daemon** — DO Container Registry is $5/mo with marginal pull-speed gain. Hub has rate limits that bit us in development.

## How CI pushes

The `ghcr-push:` job in `.github/workflows/ci.yml`:

1. `actions/checkout@v4`
2. `docker/setup-buildx-action@v3` — modern multi-arch builder
3. `docker/login-action@v3` with `GITHUB_TOKEN`
4. `docker/build-push-action@v5` — multi-stage build, push two tags (`<sha>` + `latest`), GHA cache enabled.

The build runs the multi-stage `infra/AppDockerfile` — builder stage runs `tools/docker-prebuild.js` (boots ephemeral mongo + standalone-graphql, runs `next build --webpack`), runtime stage carries the prebuilt artefacts.

## Image layout

```
ghcr.io/gatispriede/cms:<sha>     # immutable per-commit tag
ghcr.io/gatispriede/cms:latest    # rolling pointer to the most recent push
```

The Kamal deploy resolves to `<sha>` (not `latest`) — `kamal deploy` reads the working-tree SHA at deploy time and pins the image to it, so a deploy can always reproduce a specific commit's runtime regardless of what `latest` currently points to.

## Local pull (for repro)

```bash
# 1. Auth (one-time per workstation)
echo $GHCR_PAT | docker login ghcr.io -u gatispriede --password-stdin
# GHCR_PAT is a GitHub personal-access token with read:packages scope

# 2. Pull a specific commit's image
docker pull ghcr.io/gatispriede/cms:abc1234

# 3. Run it locally for repro (mongo + env still need to be supplied)
docker run --rm \
  -e MONGODB_URI='mongodb://host.docker.internal:27017/cms' \
  -p 8080:80 \
  ghcr.io/gatispriede/cms:abc1234
```

## Retention

Keep last 10 SHA-tagged images per branch; `latest` is exempt from retention. Implemented via:

- GitHub Settings → Packages → cms → Manage Retention rules → "Keep last 10 versions" (per branch ref).
- Or via API: `gh api -X DELETE /user/packages/container/cms/versions/<id>` for one-off prunes.

Storage stays under 1 GB even with 10 SHA-tagged + `latest` images (each is ~250 MB compressed, multi-stage cuts ~40% off the legacy single-stage size).

## Adding a new tenant's image namespace

Currently one namespace (`cms`) covers both funisimo + skyclimber — they ship the same image, just with different runtime env. If a tenant ever needs a different image (e.g. tenant-specific feature flag baked in), give it its own namespace:

```yaml
# .github/workflows/ci.yml
ghcr.io/gatispriede/cms-tenantname:${{ github.sha }}
```

Update the corresponding `config/deploy.<tenant>.yml`'s `image:` line to match.

## Common failure modes

### `permission_denied` on push from CI

`secrets.GITHUB_TOKEN` doesn't carry `packages: write` by default in workflow files that don't declare `permissions:`. Make sure the `ghcr-push:` job has:

```yaml
permissions:
  contents: read
  packages: write
```

(Already set in `ci.yml` — but if you copy the job to a new workflow, port the `permissions:` block.)

### Manifest unknown / 404 on pull

The image was pruned by retention. Check the package versions list — if the SHA is gone, build is gone too. Solutions:

- Re-push by retriggering the master CI job for that commit
- Use a more recent SHA + `kamal rollback` if you need to back out

### Build cache stale, image is huge

GHA cache (`type=gha,mode=max`) sometimes accumulates stale layers. Clear via Settings → Actions → Caches → search "buildx" → delete. Next build rehydrates clean.

## Related

- [`docs/runbooks/kamal-deploy.md`](kamal-deploy.md) — Kamal pulls from GHCR.
- [`infra/AppDockerfile`](../../infra/AppDockerfile) — the multi-stage Dockerfile being pushed.
- [`tools/docker-prebuild.js`](../../tools/docker-prebuild.js) — the prebuild script the builder stage runs.
