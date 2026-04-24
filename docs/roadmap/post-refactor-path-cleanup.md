# Post-refactor path cleanup

_Tracked follow-up from the `production-caching-tier1-progress` session
(2026-04-24). These aren't on the deploy hot path, so they were deferred
while we stabilised the droplet — but they'll bite when the relevant
tooling runs._

## Context

The repo was reshaped in commit `d0410b1 refactoring`:

- `src/frontend/**` → `ui/client/**` (+ admin split under `ui/admin/`)
- `src/Server/**` → `services/**` (features/, api/, infra/)
- root `compose.yaml` → `infra/compose.yaml`

Most runtime paths were caught at the time, but a handful of stale
references in peripheral tooling and doc comments survived. The
`.gitignore` rules are already path-agnostic, so the reshape doesn't
leave stale ignore entries — but individual scripts and prose need a
pass.

## Runtime-relevant stragglers to delete/rewrite

### Delete outright

- **`tools/scripts/deploy.sh`** — pre-Docker rsync + pm2 flow. Still
  references `src/frontend/.next/`, `src/frontend/public/`, and
  `src/Server/schema.graphql`. Superseded entirely by the GHA →
  Docker Compose deploy; nothing invokes this script today. Safe to
  delete along with the matching "deploy script" doc entries.
- **`tools/scripts/merge-admin-locales.js`** — one-shot that already
  ran its course. Reads `/tmp/admin-strings.json` (ephemeral) and
  writes to `src/frontend/admin-locales/{en,lv}.json` which no longer
  exist (locale files now live under `ui/admin/i18n/`). Kept
  historically but has no reason to be invoked again.

## Cosmetic doc refs (non-breaking, low urgency)

Comment strings and docstrings still referencing the old paths.
Functionally harmless but misleading when someone clicks through:

- `README.md` — `src/Server/index.ts`, `src/Server/graphqlResolvers.ts`,
  `src/Server/authz.ts` links.
- `.env.example:1` — "Copy this file to `.env.local` (or
  `src/frontend/.env`)".
- `shared/types/{ITheme,ISiteSeo,IPost,IFooter,ISection}.ts` —
  `See src/Server/conflict.ts` doc comments. Live at
  `services/infra/conflict.ts` now.
- `services/api/schema.graphql:140` — same `src/Server/conflict.ts`
  reference in a schema comment.
- `services/api/generated/schema.generated.ts:499` — generated, will
  fix itself the next time the schema is re-generated.
- `services/infra/conflict.ts`, `services/features/Languages/LanguageService.ts`,
  `services/api/graphqlResolvers.ts` — doc headers reference
  `src/frontend/lib/conflict.ts`, `src/frontend/public/locales/`,
  `src/Server/index.ts`.
- `ui/client/lib/{ConflictDialog.tsx,conflict.ts}` — same conflict.ts
  path reference.
- `ui/admin/lib/itemTypes/registry.ts:13-15` — renderer/editor
  location comments still point at `src/frontend/`.
- `ui/admin/i18n/adminI18n.ts:12` — "drop a new file under
  `src/frontend/admin-locales/`" (now `ui/admin/i18n/`).
- `next-sitemap.config.cjs:17` — inline comment about
  `src/frontend/pages/[...slug].tsx`.

## Suggested approach

1. Delete `tools/scripts/deploy.sh` + `tools/scripts/merge-admin-locales.js`.
2. Run a single search-and-replace pass over `shared/`, `services/`,
   `ui/`, `README.md`, `.env.example`, `next-sitemap.config.cjs`:
   - `src/frontend/` → `ui/client/`
   - `src/frontend/admin-locales/` → `ui/admin/i18n/`
   - `src/Server/` → `services/infra/` (or `services/` depending on
     the target file — mostly `services/infra/conflict.ts` and
     `services/infra/mongoDBConnection.ts`).
3. Spot-check each touched file; these are comments, so a bad
   substitution won't break runtime but could mislead future readers.

## Already fixed

Captured in previous commits, don't redo:

- `.github/workflows/ci.yml` — `src/frontend/tsconfig.json` → `ui/client/tsconfig.json`
- `infra/compose.yaml` — `.env` path + bind-mount paths (../uploads, ../mongo_data)
- `infra/AppDockerfile` / `infra/ServerDockerfile` — removed gitignored
  `infra/certificates` COPY
- `tools/scripts/update-google-fonts.ts` — `src/frontend/data/` → `services/infra/data/`
- `tools/scripts/cleanup-ghost-navigation.ts` — import path + tsconfig
- `services/infra/mongoDBConnection.ts` — ghost-navigation hint string
- `yarn.lock` + `package-lock.json` — regenerated to match current `package.json`
