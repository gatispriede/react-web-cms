# Automatic deployment + easy first-time setup

## Goal

One command from cold machine to running CMS. Today deployment is manual: clone, fill env vars, `docker compose up`, hope nothing drifts. Target: a bootstrap script + CI/CD pipeline that makes deployment repeatable and a fresh server trivial to stand up.

## Design

### First-setup bootstrap

Single shell script `scripts/bootstrap.sh` that:

1. Checks prerequisites (Docker, docker-compose, git, openssl); refuses to continue if any missing
2. Clones the repo to `/opt/cms` (or a configurable path)
3. Generates secrets not already set:
   - `NEXTAUTH_SECRET` (openssl rand -hex 32)
   - `ADMIN_USERNAME` (prompt with default `admin`)
   - Leaves `ADMIN_DEFAULT_PASSWORD` intentionally unset — relies on the first-boot-password flow (see [first-boot-admin-password.md](first-boot-admin-password.md)) to generate + surface
4. Writes `.env` from a template with sane defaults
5. Boots containers: `docker compose up -d`
6. Waits for `/api/health` to return 200 (with a timeout)
7. Prints the captured first-boot admin password + the login URL

### CI/CD pipeline

GitHub Actions workflow (`.github/workflows/deploy.yml`):

- Trigger: push to `main`
- Steps:
  1. Lint + test (`npm ci`, `npm run typecheck`, `npm test`)
  2. Build the two Docker images (App + Server)
  3. Push to registry (GitHub Container Registry — `ghcr.io/<user>/cms-app:$(git-sha)`, `:latest`)
  4. Deploy: SSH to prod host, `git pull`, `docker compose pull`, `docker compose up -d`, wait for health, rollback on failure
  5. Run DB migration script if `Scripts/migrate-*.ts` touched by the commit

Rollback: `docker compose up -d --no-deps` with the previous tag (`git-sha`). Keep last 5 tags in the registry, GC older ones weekly.

### Health endpoint

New `ui/client/pages/api/health.ts`:

- Returns 200 if Mongo is reachable, Redis is reachable, and the setupAdmin ran (admin user exists)
- Used by the bootstrap script and by CI deploy for readiness checks

### First-setup UX on the admin side

After first boot, if the site has zero content, redirect the admin to a `/admin/welcome` wizard (3 steps):

1. Set site title + tagline
2. Pick a theme preset
3. Create the first page

Skippable, but defaults are pre-filled so a click-through takes under 60 seconds.

## Files to touch

- `scripts/bootstrap.sh` (new)
- `.env.example` (new if missing, or updated)
- `.github/workflows/deploy.yml` (new)
- `.github/workflows/ci.yml` (new) — lint + test on PR
- `ui/client/pages/api/health.ts` (new)
- `ui/admin/pages/welcome.tsx` (new)
- `ui/client/lib/Admin/WelcomeWizard.tsx` (new)
- `DEPLOY.md` — rewrite around the bootstrap script; link to health + welcome flow
- `compose.yaml` — confirm image references use registry, not `build:` in prod

## Acceptance

- Clean Ubuntu droplet + `curl -L bootstrap-url | bash` → CMS reachable + admin password in hand in under 5 minutes
- `git push origin main` → pipeline runs → prod updated within 8 minutes, no manual SSH
- `/api/health` returns 200 with Mongo + admin check; 503 if either fails
- Welcome wizard shows on true first-admin-login; does not re-appear on subsequent visits
- Rolling back to the previous tag is a single `docker compose up` command

## Risks / notes

- Don't store registry credentials in the repo. Use GitHub Actions secrets + a deploy key on the server
- Bootstrap script idempotency — re-running it on an existing install should update the compose file and containers, not reinstall
- `docker compose pull` downtime is ~5–15 s per container. For zero-downtime, put the App behind HAProxy / Traefik with blue-green; out of scope for this pass, document it

## Effort

**L · 2–3 engineering days**

- Bootstrap script + testing on fresh VM: 4–6 h
- Health endpoint + tests: 1 h
- CI workflow + registry setup: 3–5 h
- Deploy workflow + rollback tested: 3–5 h
- Welcome wizard: 3–4 h
- Full end-to-end dry run on a throwaway droplet: 2 h
