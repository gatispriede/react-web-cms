# Local prod-image validation

A docker-compose stack at `infra/compose.local-prod-test.yaml` runs the production-built image against a real Mongo locally. **Use it before pushing risky build / deploy changes** — it catches the class of bug where `npm run dev` works fine but the prod image is broken.

## Why this exists

The 2026-05-08 deploy iteration burned several hours on issues that local dev couldn't reproduce because dev mode and prod mode have different rendering paths:

| Aspect | `npm run dev` | Production image |
|---|---|---|
| Page rendering | Pure SSR, every request | Static pre-render at build time |
| Module bundling | Webpack dev mode | Webpack prod build (or standalone tracer) |
| Mongo at build time | Real local instance | Empty in-memory (`tools/docker-prebuild.js`) |
| Native bindings | Built against host libc | Built against builder image's libc |

Bugs that surface only in prod:

- `/` baked with `showLanding=true` because build-time Mongo is empty.
- ESM-only files missing in standalone bundles (`@reduxjs/toolkit/dist/redux-toolkit.modern.mjs`).
- Native bindings linked against glibc but runtime is alpine/musl.
- File path resolution differs because cwd changes between dev and standalone runtime.

The local stack reproduces all four without touching production.

## One-time setup

Pull a fresh dump of the production Mongo into the gitignored seed directory:

```bash
ssh root@funisimo.pro 'docker exec mongodb mongodump --db DB --archive' \
  > infra/datasets/mongo-seed/dump.archive
```

Refresh whenever production data drifts enough that local validation against stale data isn't useful.

## Per-validation workflow

```bash
# 1. Build the production image locally
docker build --file infra/AppDockerfile \
  --build-arg GIT_SHA=$(git rev-parse HEAD) \
  --tag cms:local-prod-test .

# 2. Bring up the stack (mongo + seed + cms)
docker compose -f infra/compose.local-prod-test.yaml up -d

# 3. Wait for boot
sleep 10
docker compose -f infra/compose.local-prod-test.yaml logs cms | tail -20

# 4. Smoke
curl -sf http://localhost:18080/api/health   # → 200, returns bootId/uptime
curl -s http://localhost:18080/ | head -c 200     # verify real content
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:18080/admin

# 5. Tear down (-v drops the mongo volume)
docker compose -f infra/compose.local-prod-test.yaml down -v
```

## What "real content" looks like

Curl `/` and grep for content markers. **Real content** has page-specific text like theme names, navigation entries, etc. **Landing fallback** has marketing copy: "MCP-native", "Your team writes", etc.

```bash
curl -s http://localhost:18080/ | grep -oiE "(MCP-native|YOUR TEAM|industrial|home)" | sort -u
```

If the only matches are "MCP-native" / "YOUR TEAM", the page is the marketing landing — `getStaticProps` baked an empty-Mongo state. Fix before pushing.

## What to check on every prod-image-affecting change

| Change | What to check locally |
|---|---|
| Dockerfile edits | Image builds end-to-end, container boots, all routes return non-500 |
| `next.config.js` changes (especially `output:` mode) | All pages render real content; no `Cannot find module` errors in logs |
| New / upgraded npm dependency | No native binding errors at boot; module resolution works |
| Schema or resolver changes | `/api/graphql` POST returns expected shape |
| Page render logic changes (`getStaticProps`, `getServerSideProps`, etc.) | Page content matches expected runtime data, not build-time state |

## CI integration (future)

This validation is currently **operator-driven** — run it before pushing risky changes. A future improvement: bake the local-prod-test smoke into a CI job that runs after `ghcr-push:` but before `deploy-funisimo:`. Would need a sanitised seed dump checked in (no PII), or a synthetic seeder that mints representative data.

For now, the operator workflow is: build risky changes locally, smoke against the seeded stack, push only when smoke is green.

## Related

- [`docs/runbooks/kamal-deploy.md`](kamal-deploy.md) — production deploy flow.
- [`infra/compose.local-prod-test.yaml`](../../infra/compose.local-prod-test.yaml) — the stack.
- [`infra/datasets/mongo-seed/.gitignore`](../../infra/datasets/mongo-seed/.gitignore) — keeps `dump.archive` out of git.
