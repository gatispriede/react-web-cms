# MCP rollout — aftermath bugs + improvements

Status: Open
Last updated: 2026-05-06

Issues surfaced during the MCP HTTP transport rollout to funisimo.pro and skyclimber.pro on 2026-05-06. Each entry: where it lives, the symptom, the fix (if applied) or the proposed direction.

---

## 1. `section.update` advertises "upserts" but rejects unknown ids

| Field | Value |
|---|---|
| Severity | medium |
| Where | `services/features/Navigation/NavigationService.ts:194` |
| Symptom | `section.update` with a chosen id returns `{error: "Section X not found"}`. Implicit-id (omitted `id`) creates a new section with a random uuid. |
| Cause | The MCP tool description says "Upserts" but the implementation only inserts when `section.id` is omitted entirely; passing a non-existent id is treated as a missing-doc error. |
| Fix proposal | Either (A) change the description to "Update or create (omit id to create)" — accurate to current behaviour, or (B) actually upsert when both `pageName` and an unknown id are provided. (A) is a 1-line change and matches every other "create-or-update" pattern in this codebase; (B) lets MCP callers use semantic ids like `cv-sec-mcp-hero` instead of uuids. |
| Impact | AI callers that try to use semantic ids end up with random uuids in the page's sections array. Cosmetic for rendering, but it loses grep-ability when debugging. |

## 2. Caddy `MCP_ALLOWED_CIDR=` empty-string trap

| Field | Value |
|---|---|
| Severity | medium |
| Where | `infra/Caddyfile`, the `@mcp-blocked` matcher with `not remote_ip {$MCP_ALLOWED_CIDR:0.0.0.0/0}` |
| Symptom | First prod deploy 403'd every request to `/mcp` even though `MCP_ALLOWED_CIDR` was unset. |
| Cause | Caddy's `{$VAR:default}` substitution treats an env var set to empty string as the literal value `""`, NOT as "use default". `not remote_ip ""` matches every IP, so the `@mcp-blocked` matcher always triggers. |
| Fix applied | Documented the gotcha in `secrets.md`'s `DEPLOY_ENV_FILE_*` blocks: set `MCP_ALLOWED_CIDR=0.0.0.0/0` for bearer-only mode. |
| Better fix | Drop the matcher entirely when the var is empty. Caddy's matcher syntax doesn't expose conditional-on-env elegantly; cleanest is two named matchers and an `import`-ed snippet, swapped at compose time. |

## 3. mcp container missing from front-end docker network

| Field | Value |
|---|---|
| Severity | medium (caught) |
| Where | `infra/compose.yaml`, `mcp` service `networks:` |
| Symptom | Caddy returned 502 with `wget: bad address 'mcp:8788'`. |
| Cause | `mcp` was on `db, back-end` only; Caddy is on `front-end` only. No shared network → Caddy couldn't resolve the service hostname. |
| Fix applied | `15fa58a` — added `front-end` to the mcp service's networks. |
| Follow-up | Add a deploy-time lint: any service Caddy reverse-proxies to must share at least one network with the caddy service. Ideally fail compose `up` if the topology is broken. |

## 4. mcp healthcheck used `localhost` (IPv6 trap on Alpine)

| Field | Value |
|---|---|
| Severity | low (caught) |
| Where | `infra/compose.yaml`, `mcp` service `healthcheck.test` |
| Symptom | `mcp` showed `Up X (unhealthy)` despite the service serving fine — `wget` returned `Connection refused` from inside the container. |
| Cause | Alpine resolves `localhost` to `::1` (IPv6) first; Express binds to `0.0.0.0` (IPv4 only); the v6 connection attempt gets `ECONNREFUSED` and the v4 fallback isn't tried by the busybox `wget`. |
| Fix applied | `15fa58a` — switched to `127.0.0.1` explicitly. |
| Follow-up | Lint pass over all compose healthchecks for the `localhost` substring. Or bind Express to both v4 and v6 (`Express.listen(port, '::')` works on dual-stack boxes). |

## 5. Local dev token issuer omits `admin:bundle` scope

| Field | Value |
|---|---|
| Severity | medium (DX) |
| Where | `tools/mcp-dev-token.js`, the `SCOPES` array |
| Symptom | `bundle.export` / `bundle.import` MCP calls from the local dev token return `{error: "Token missing scope: admin:bundle"}`. Forced a one-off `tools/import-bundle-local.mts` workaround during the funisimo→local fixture sync. |
| Cause | The default SCOPES list was hand-curated and never updated when `admin:bundle` was added. |
| Fix proposal | Add `'admin:bundle'` to the SCOPES array in `tools/mcp-dev-token.js`. Single-line change. |
| Notes | Local dev token deliberately has all scopes — local Mongo is throwaway. Production tokens should still be issued with least-privilege via the admin UI. |

## 6. `appleboy/ssh-action` `script_stop: true` aborts on `if`-test failures

| Field | Value |
|---|---|
| Severity | medium (caught) |
| Where | `.github/workflows/ci.yml`, the `Deploy via SSH` step |
| Symptom | Deploy aborted right after `Container front Started` with `Process exited with status 1` and no further log lines. |
| Cause | `script_stop: true` joins script lines with `&&`-style chaining, which aborts on ANY non-zero exit code — including `[ "$X" = "Y" ]` test commands that bash's own `set -e` correctly handles without aborting. |
| Fix applied | `3f8e03e` — disabled `script_stop`, kept the inline `set -euo pipefail`. |
| Documented | `docs/runbooks/deploy-troubleshooting.md` § 1. |

## 7. `appleboy/ssh-action` SSH session drops on long docker builds

| Field | Value |
|---|---|
| Severity | low (mitigated) |
| Where | `.github/workflows/ci.yml`, the `Deploy via SSH` step |
| Symptom | Deploy aborted at ~6m42s during the docker build's quiet stretch (single layer cache restore, single `next build` SSG pass). All build output streamed correctly up to the abort. |
| Cause | The SSH channel sat idle from the TCP socket's perspective during a long stretch with no byte flow; an intermediate firewall / NAT dropped it. |
| Fix applied | `cba4d92` — 20s background heartbeat that prints `[heartbeat HH:MM:SS]` constantly, keeps the socket warm. |
| Permanent fix | Move the build off the remote (build on GHA runners, push image to GHCR, droplet does `docker pull` + `compose up`). That's the Phase B of the Kamal migration in `terraform-kamal-migration.md`. |

## 8. Mongo healthcheck uses removed `mongo` shell

| Field | Value |
|---|---|
| Severity | low (cosmetic) |
| Where | `infra/compose.yaml`, `mongodb` service |
| Symptom | `docker compose ps` shows `mongodb` as `Up X (unhealthy)` permanently. App + server + caddy connect fine; nothing depends on mongo's healthy state. |
| Cause | Healthcheck shells `mongo --eval` — the `mongo` binary was removed in MongoDB 6.x and the image is `mongo:7.0`. |
| Fix proposal | Switch to `mongosh`: `mongosh --quiet --eval "db.runCommand({ping:1}).ok" mongodb://mongodb:27017/ \| grep -q 1` |
| Deferred | Per the cattle-not-pets stance — droplets are disposable, content reproducible from bundle export, and nothing currently gates on mongo's health status. |

## 9. Pages without audit triplet aren't auto-stamped on no-op `page.update`

| Field | Value |
|---|---|
| Severity | low |
| Where | `services/features/Navigation/NavigationService.ts`, the page-update path |
| Symptom | `cv-nav-cms` (and other pre-audit-triplet records) lack `editedAt`/`editedBy`. Calling `page.update` with the same `page` value to force-stamp them is detected as a no-op and skipped. |
| Fix proposal | Either (A) always stamp the audit triplet on `page.update` regardless of whether content actually changed, or (B) add an explicit `page.touch` MCP tool that bumps `editedAt`/`editedBy`/`version` without touching content. |
| Notes | (A) is more invasive; (B) is one new tool definition + an MCP scope check (admin or write:content). Recommend (B). |

## 11. INFRA_TOPOLOGY field-name mismatch — SVGs silently absent

| Field | Value |
|---|---|
| Severity | medium (existing data) |
| Where | `cv-sec-cms-infra`, `cv-sec-lss-infra` (and any new `INFRA_TOPOLOGY` authored from the parent's shape as a template) |
| Symptom | The topology SVG never renders. The droplet cards show, the eyebrow + title show, but the diagram doesn't. |
| Cause | Authors used `svg` and `caption` in the JSON content; the `IInfraTopology` type and renderer expect `topologySvg` and `topologyCaption`. Section saves the wrong-shaped JSON without a schema warning. |
| Fix applied | `cv-sec-cms-infra` and `cv-sec-lss-infra` rewritten with the correct field names on local. Prod replication pending. |
| Follow-up | Add a `validateSectionInput` pass for INFRA_TOPOLOGY content that warns when the legacy field names are present. Better: support both via the content manager's `normalize` step (read `svg` → `topologySvg`) so older bundles don't break on import. |

## 12. Bundle import filename-sanitization breaks asset references

| Field | Value |
|---|---|
| Severity | medium (real content breakage on import) |
| Where | `services/features/Bundle/BundleService.ts:209-219` (`sanitizeAssetName`) |
| Symptom | After importing the funisimo bundle locally, the home-page hero portrait (and any other image whose original filename contained parens / spaces) showed a broken-image icon stacked on top of the portrait tile's background-color — looks like "two backgrounds". |
| Cause | `sanitizeAssetName` replaces every char outside `[a-zA-Z0-9._-]` with `_`. So `20260426_162153(0).jpg` lands on disk as `20260426_162153_0_.jpg`. The DB entries are NOT rewritten, so the page still requests the original name and 404s. The sanitizer is too aggressive — parens, spaces, plus signs, etc. are valid filename chars on every supported filesystem. |
| Fix proposal | Either (A) tighten the sanitizer to only reject security-critical chars (null bytes, control chars, `..` segments, path separators) and leave parens/spaces/plus alone; (B) when the sanitizer renames a file, walk the same JSON structures `collectLocalAssets` walks and rewrite every reference; or (C) keep the sanitizer aggressive but emit `skippedAssets` entries for filenames that needed rename (so the operator sees them). |
| Workaround | One-off `cp <sanitized> <original>` for each affected image after import — see `tools/import-bundle-local.mts` notes. |

## 10. e2e workflow disabled to manual-only

| Field | Value |
|---|---|
| Severity | low |
| Where | `.github/workflows/e2e.yml`, `on:` triggers |
| Symptom | Playwright suite no longer runs on push or PR; only manual `workflow_dispatch`. |
| Cause | Suite was flaky enough during this rollout to consume more attention than it caught. Deferred to local runs (`npm run e2e`). |
| Fix proposal | Stabilise the suite (chase flakes one by one, mark as `test.skip` or fix), then re-enable `pull_request` + `push` triggers on `e2e.yml`. |

---

## Cross-cutting follow-ups

These aren't bugs in any single file — they're patterns we noticed during the rollout that warrant their own work:

- **Compose-time topology lint**: catch issues 3 and 4 above by validating that every reverse-proxied service shares a network with caddy and uses an IP-literal in healthchecks.
- **Section creation tooling for AI authoring**: the AI workflow of building a page section-by-section (like this MCP annex) needs `section.create` to accept semantic ids cleanly. Fix issue 1.
- **Bundle export/import tooling**: the funisimo → local sync we did this session ended up requiring a tsx workaround because the local dev token didn't have `admin:bundle`. Fix issue 5 and document the canonical "pull prod bundle to local for visual iteration" flow in `docs/runbooks/`.
- **Audit triplet enforcement**: most edits stamp; some legacy paths don't. Add a Mongo middleware (or a service-level wrapper) that stamps on every write, and remove the per-service stamp logic.
