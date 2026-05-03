# Setup

## First install

The CMS ships as a Next.js app backed by MongoDB. Two paths:

- **Docker** — `docker compose up` builds the Next standalone bundle, starts Mongo, runs migrations, and exposes the site on port 80.
- **Local dev** — `npm install`, then `npm run dev`. Requires a reachable Mongo (set `MONGODB_URI`).

On first boot the database is empty. Visit `/admin` and the **onboarding wizard** loads.

## Onboarding wizard

Three steps, each saves immediately:

1. **Site identity** — name, logo, default language.
2. **Admin account** — email + password for the first user (rank: `admin`).
3. **Theme** — pick one of the built-in presets (Classic, Editorial, Mono, Vivid). You can swap or customise later under **Themes**.

After step 3 you're dropped at `/admin/build`. The site has one empty Home page; add modules from the Modules dialog or import a bundle.

## Environment variables

Required:

- `MONGODB_URI` — connection string. Default: `mongodb://localhost:27017/cms`.
- `SESSION_SECRET` — signs auth cookies. 32+ random chars.

Optional:

- `BUILD_PORT` — when running the standalone GraphQL server in Docker.
- `INTERNAL_GRAPHQL_URL` — overrides the build-time GraphQL endpoint.
- `MCP_TOKEN_SECRET` — signs MCP issuance tokens.
- `FEATURE_<NAME>=on|off` — env-level override for any plug-and-play feature (see **Feature flags** pane).

A boot-bound change (e.g. flipping `FEATURE_ECOMMERCE`) shows a "Restart required" banner in the admin and exposes a `bootId` poll that auto-reloads connected admin sessions once the new process is up.

## Health check

`GET /api/health` returns `{ok: true, bootId: '<uuid>'}` once the app is ready. Use it for container probes.
