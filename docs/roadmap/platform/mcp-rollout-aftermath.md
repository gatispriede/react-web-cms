# MCP rollout — aftermath bugs + improvements

Status: Closed (2026-05-14) — every in-scope issue is fixed or has a recorded terminal disposition (deferred / wontfix). See per-issue status blocks below.
Last updated: 2026-05-14

Issues surfaced during the MCP HTTP transport rollout to funisimo.pro and skyclimber.pro on 2026-05-06. Each entry: where it lives, the symptom, the fix (if applied) or the proposed direction.

**2026-05-14 closeout.** The batched-fixes chunk (README Wave 3 #14 — issues #1 / #5 / #9 / #11 / #12) was implemented in code but the spec doc was never reconciled. This pass verified every issue against current code and recorded a terminal status on each. Net: all five batched issues are fixed (code + co-located tests already present); the SEO pair #13 / #14 fixed; the infra/CI issues #3 / #4 / #6 / #7 fixed by the cited commits; #2 documented; #8 deferred (backlog); #10 deferred (flaky-suite stabilisation). Nothing left open.

---

## 1. `section.update` advertises "upserts" but rejects unknown ids

**Status: FIXED (2026-05-14 verified).** Took option (B) — `addUpdateSectionItem` now genuinely upserts. `NavigationService.ts` (lines ~222–243): an unknown `section.id` **with** a `pageName` inserts the section with the chosen id and attaches it to the page's `sections[]`, returning `{createSection: {id, version: 1, upserted: true}}`. An unknown id **without** `pageName` is still rejected (would orphan the section the nav tree never references) with an explicit error message. The MCP `section.update` tool description ("Upsert one or many sections") is now accurate. Co-located tests cover both paths (`NavigationService.test.ts` — "upserts an unknown id when pageName is given", "rejects an unknown id when no pageName is given").

| Field | Value |
|---|---|
| Severity | medium |
| Where | `services/features/Navigation/NavigationService.ts:194` |
| Symptom | `section.update` with a chosen id returns `{error: "Section X not found"}`. Implicit-id (omitted `id`) creates a new section with a random uuid. |
| Cause | The MCP tool description says "Upserts" but the implementation only inserts when `section.id` is omitted entirely; passing a non-existent id is treated as a missing-doc error. |
| Fix proposal | Either (A) change the description to "Update or create (omit id to create)" — accurate to current behaviour, or (B) actually upsert when both `pageName` and an unknown id are provided. (A) is a 1-line change and matches every other "create-or-update" pattern in this codebase; (B) lets MCP callers use semantic ids like `cv-sec-mcp-hero` instead of uuids. |
| Impact | AI callers that try to use semantic ids end up with random uuids in the page's sections array. Cosmetic for rendering, but it loses grep-ability when debugging. |

## 2. Caddy `MCP_ALLOWED_CIDR=` empty-string trap

**Status: DOCUMENTED (no code change).** The gotcha is recorded in `secrets.md` (`DEPLOY_ENV_FILE_*` blocks) — set `MCP_ALLOWED_CIDR=0.0.0.0/0` for bearer-only mode. The "better fix" (drop the matcher when the var is empty via two named matchers + an `import`-ed snippet) is a Caddyfile refactor outside this chunk's scope; left as a follow-up note here. Not blocking — the documented workaround is sufficient.

| Field | Value |
|---|---|
| Severity | medium |
| Where | `infra/Caddyfile`, the `@mcp-blocked` matcher with `not remote_ip {$MCP_ALLOWED_CIDR:0.0.0.0/0}` |
| Symptom | First prod deploy 403'd every request to `/mcp` even though `MCP_ALLOWED_CIDR` was unset. |
| Cause | Caddy's `{$VAR:default}` substitution treats an env var set to empty string as the literal value `""`, NOT as "use default". `not remote_ip ""` matches every IP, so the `@mcp-blocked` matcher always triggers. |
| Fix applied | Documented the gotcha in `secrets.md`'s `DEPLOY_ENV_FILE_*` blocks: set `MCP_ALLOWED_CIDR=0.0.0.0/0` for bearer-only mode. |
| Better fix | Drop the matcher entirely when the var is empty. Caddy's matcher syntax doesn't expose conditional-on-env elegantly; cleanest is two named matchers and an `import`-ed snippet, swapped at compose time. |

## 3. mcp container missing from front-end docker network

**Status: FIXED** by `15fa58a` (cited below). The "follow-up" (compose-time topology lint) is tracked in the Cross-cutting follow-ups section, not this issue.

| Field | Value |
|---|---|
| Severity | medium (caught) |
| Where | `infra/compose.yaml`, `mcp` service `networks:` |
| Symptom | Caddy returned 502 with `wget: bad address 'mcp:8788'`. |
| Cause | `mcp` was on `db, back-end` only; Caddy is on `front-end` only. No shared network → Caddy couldn't resolve the service hostname. |
| Fix applied | `15fa58a` — added `front-end` to the mcp service's networks. |
| Follow-up | Add a deploy-time lint: any service Caddy reverse-proxies to must share at least one network with the caddy service. Ideally fail compose `up` if the topology is broken. |

## 4. mcp healthcheck used `localhost` (IPv6 trap on Alpine)

**Status: FIXED** by `15fa58a` (cited below). Follow-up lint tracked in Cross-cutting follow-ups.

| Field | Value |
|---|---|
| Severity | low (caught) |
| Where | `infra/compose.yaml`, `mcp` service `healthcheck.test` |
| Symptom | `mcp` showed `Up X (unhealthy)` despite the service serving fine — `wget` returned `Connection refused` from inside the container. |
| Cause | Alpine resolves `localhost` to `::1` (IPv6) first; Express binds to `0.0.0.0` (IPv4 only); the v6 connection attempt gets `ECONNREFUSED` and the v4 fallback isn't tried by the busybox `wget`. |
| Fix applied | `15fa58a` — switched to `127.0.0.1` explicitly. |
| Follow-up | Lint pass over all compose healthchecks for the `localhost` substring. Or bind Express to both v4 and v6 (`Express.listen(port, '::')` works on dual-stack boxes). |

## 5. Local dev token issuer omits `admin:bundle` scope

**Status: FIXED (2026-05-14 verified).** `tools/mcp-dev-token.js` — the `SCOPES` array now includes `'admin:bundle'` (with an inline comment citing this issue). `bundle.export` / `bundle.import` MCP calls from the local dev token work without the one-off `tools/import-bundle-local.mts` workaround. Production tokens stay least-privilege via the admin UI as the doc intends.

| Field | Value |
|---|---|
| Severity | medium (DX) |
| Where | `tools/mcp-dev-token.js`, the `SCOPES` array |
| Symptom | `bundle.export` / `bundle.import` MCP calls from the local dev token return `{error: "Token missing scope: admin:bundle"}`. Forced a one-off `tools/import-bundle-local.mts` workaround during the funisimo→local fixture sync. |
| Cause | The default SCOPES list was hand-curated and never updated when `admin:bundle` was added. |
| Fix proposal | Add `'admin:bundle'` to the SCOPES array in `tools/mcp-dev-token.js`. Single-line change. |
| Notes | Local dev token deliberately has all scopes — local Mongo is throwaway. Production tokens should still be issued with least-privilege via the admin UI. |

## 6. `appleboy/ssh-action` `script_stop: true` aborts on `if`-test failures

**Status: FIXED** by `3f8e03e` (cited below) + documented in `docs/runbooks/deploy-troubleshooting.md` § 1.

| Field | Value |
|---|---|
| Severity | medium (caught) |
| Where | `.github/workflows/ci.yml`, the `Deploy via SSH` step |
| Symptom | Deploy aborted right after `Container front Started` with `Process exited with status 1` and no further log lines. |
| Cause | `script_stop: true` joins script lines with `&&`-style chaining, which aborts on ANY non-zero exit code — including `[ "$X" = "Y" ]` test commands that bash's own `set -e` correctly handles without aborting. |
| Fix applied | `3f8e03e` — disabled `script_stop`, kept the inline `set -euo pipefail`. |
| Documented | `docs/runbooks/deploy-troubleshooting.md` § 1. |

## 7. `appleboy/ssh-action` SSH session drops on long docker builds

**Status: FIXED (mitigated)** by `cba4d92` (heartbeat, cited below). The permanent fix — move the build off the remote — is Phase B of `terraform-kamal-migration.md`, tracked there, not here.

| Field | Value |
|---|---|
| Severity | low (mitigated) |
| Where | `.github/workflows/ci.yml`, the `Deploy via SSH` step |
| Symptom | Deploy aborted at ~6m42s during the docker build's quiet stretch (single layer cache restore, single `next build` SSG pass). All build output streamed correctly up to the abort. |
| Cause | The SSH channel sat idle from the TCP socket's perspective during a long stretch with no byte flow; an intermediate firewall / NAT dropped it. |
| Fix applied | `cba4d92` — 20s background heartbeat that prints `[heartbeat HH:MM:SS]` constantly, keeps the socket warm. |
| Permanent fix | Move the build off the remote (build on GHA runners, push image to GHCR, droplet does `docker pull` + `compose up`). That's the Phase B of the Kamal migration in `terraform-kamal-migration.md`. |

## 8. Mongo healthcheck uses removed `mongo` shell

**Status: DEFERRED (parked in `backlog.md`).** Cosmetic — `docker compose ps` shows `mongodb` as `Up X (unhealthy)` but nothing gates on mongo's health status, the app/server/caddy connect fine, and content is reproducible from bundle export (cattle-not-pets). The `mongosh` one-liner fix is recorded in the proposal above; pick it up if a real driver appears (a future feature that *does* gate on mongo health). Confirmed still parked per README backlog line.

| Field | Value |
|---|---|
| Severity | low (cosmetic) |
| Where | `infra/compose.yaml`, `mongodb` service |
| Symptom | `docker compose ps` shows `mongodb` as `Up X (unhealthy)` permanently. App + server + caddy connect fine; nothing depends on mongo's healthy state. |
| Cause | Healthcheck shells `mongo --eval` — the `mongo` binary was removed in MongoDB 6.x and the image is `mongo:7.0`. |
| Fix proposal | Switch to `mongosh`: `mongosh --quiet --eval "db.runCommand({ping:1}).ok" mongodb://mongodb:27017/ \| grep -q 1` |
| Deferred | Per the cattle-not-pets stance — droplets are disposable, content reproducible from bundle export, and nothing currently gates on mongo's health status. |

## 9. Pages without audit triplet aren't auto-stamped on no-op `page.update`

**Status: FIXED (2026-05-14 verified).** Took option (B) — the recommended one. A new `page.touch` MCP tool (`services/features/Mcp/tools/pages.ts` — `pageTouch`) bumps `editedAt` / `editedBy` / `version` without touching content: it re-pulls the nav row and writes it back through `replaceUpdateNavigation`, whose `auditStamp` + version bump fire even when the rest of the doc is identical. Scoped to `write:content`, mode-enforced via `enforceModeForTool`. Registered in `PAGE_TOOLS`. Legacy pages like `cv-nav-cms` can now be force-stamped.

| Field | Value |
|---|---|
| Severity | low |
| Where | `services/features/Navigation/NavigationService.ts`, the page-update path |
| Symptom | `cv-nav-cms` (and other pre-audit-triplet records) lack `editedAt`/`editedBy`. Calling `page.update` with the same `page` value to force-stamp them is detected as a no-op and skipped. |
| Fix proposal | Either (A) always stamp the audit triplet on `page.update` regardless of whether content actually changed, or (B) add an explicit `page.touch` MCP tool that bumps `editedAt`/`editedBy`/`version` without touching content. |
| Notes | (A) is more invasive; (B) is one new tool definition + an MCP scope check (admin or write:content). Recommend (B). |

## 11. INFRA_TOPOLOGY field-name mismatch — SVGs silently absent

**Status: FIXED (2026-05-14 verified).** The follow-up landed exactly as decided 2026-05-07: new file `services/features/Navigation/normalizeSectionInput.ts` with per-content-type rename rules — INFRA_TOPOLOGY: `svg` → `topologySvg`, `caption` → `topologyCaption` (canonical key wins when both present; legacy keys preserved). Called from `addUpdateSectionItem` before `validateSectionInput` so the validator sees the canonical shape and older bundles import without breakage. Co-located `normalizeSectionInput.test.ts` covers the rename rule, the canonical-precedence case, the no-op pass-through, and malformed-JSON tolerance — all passing. `NavigationService.ts` stays under the line ceiling because normalization is its own file.

| Field | Value |
|---|---|
| Severity | medium (existing data) |
| Where | `cv-sec-cms-infra`, `cv-sec-lss-infra` (and any new `INFRA_TOPOLOGY` authored from the parent's shape as a template) |
| Symptom | The topology SVG never renders. The droplet cards show, the eyebrow + title show, but the diagram doesn't. |
| Cause | Authors used `svg` and `caption` in the JSON content; the `IInfraTopology` type and renderer expect `topologySvg` and `topologyCaption`. Section saves the wrong-shaped JSON without a schema warning. |
| Fix applied | `cv-sec-cms-infra` and `cv-sec-lss-infra` rewritten with the correct field names on local. Prod replication pending. |
| Follow-up | New file `services/features/Navigation/normalizeSectionInput.ts` (decided 2026-05-07). Called from `addUpdateSectionItem` before persistence. Per-content-type rules — INFRA_TOPOLOGY: read `svg` → `topologySvg`, `caption` → `topologyCaption`. Older bundles import without breakage; new content writes the canonical shape. Keeps `NavigationService.ts` under the 400-line ceiling by extracting normalization into its own file. Co-located test (`normalizeSectionInput.test.ts`) covers the rename rule + a no-op pass-through case. |

## 13. Blog post + index SEO was incomplete (Google rich-result eligibility)

**Status: FIXED (2026-05-14 verified).** Both `ui/client/pages/blog/[slug].tsx` and `ui/client/pages/blog/index.tsx` emit canonical, og:url, article:* meta, robots, and JSON-LD (`Article` / `Blog`) — confirmed in code. Follow-up (add `NEXT_PUBLIC_SITE_URL` to `secrets.md`) is optional per the doc since the `NEXTAUTH_URL` fallback covers it.

| Field | Value |
|---|---|
| Severity | medium (organic traffic) |
| Where | `ui/client/pages/blog/[slug].tsx` and `ui/client/pages/blog/index.tsx` |
| Symptom | Blog posts had basic OG / Twitter tags but no canonical link, no `og:url`, no `article:published_time`, no `article:author`, no `article:tag`, no `robots` meta, no JSON-LD Article schema. Google's rich-card eligibility for blog posts requires structured data; without it, posts appear as plain text-link results. |
| Fix applied | Both renderers now emit canonical, og:url, article:published_time, article:modified_time, article:author, article:tag (per tag), robots, and JSON-LD `Article` (post) / `Blog` (index) schema. Falls back from `NEXT_PUBLIC_SITE_URL` to `NEXTAUTH_URL` for the canonical URL so existing droplets work without an env-var rollout. |
| Follow-up | Add `NEXT_PUBLIC_SITE_URL` to `secrets.md`'s `DEPLOY_ENV_FILE_*` blocks (optional — `NEXTAUTH_URL` fallback already covers this). Could also enrich `Article` JSON-LD with `wordCount`, `image` dimensions, `articleSection`. |

## 14. `next-sitemap.config.cjs` had hardcoded `http://localhost`

**Status: FIXED (2026-05-14 verified).** `next-sitemap.config.cjs` — `siteUrl` reads `SITE_URL` → `NEXT_PUBLIC_SITE_URL` → `http://localhost` fallback; the internal GraphQL fetch URL stays localhost (build-host). Confirmed in code. Follow-up (verify prod sitemap + submit to Search Console) is a deploy-time operator action, not code.

| Field | Value |
|---|---|
| Severity | medium (sitemap was useless for prod SEO) |
| Where | `next-sitemap.config.cjs:4` |
| Symptom | Production builds emitted `sitemap.xml` with every URL prefixed `http://localhost/...` — Google rejects the sitemap or treats the URLs as broken. Same for `robots.txt`. Posts and pages weren't getting indexed because the canonical sitemap was wrong. |
| Fix applied | `siteUrl` now reads from `SITE_URL` → `NEXT_PUBLIC_SITE_URL` → `http://localhost` (in that order). The internal GraphQL fetch URL stays as `http://localhost` because next-sitemap runs on the build host. |
| Follow-up | Verify on the next prod deploy that `sitemap.xml` has the correct `funisimo.pro` URLs. Submit the sitemap to Google Search Console manually once. |

## 12. Bundle import filename-sanitization breaks asset references

**Status: FIXED (2026-05-14 verified).** Took option (A) — tighten the sanitizer. `BundleService.ts` `sanitizeAssetName` now only hard-rejects security-critical inputs (null bytes, control chars, `..` traversal segments, path separators, empty stem, disallowed extension) and otherwise round-trips common-case filenames unchanged — parens, spaces, plus signs, accented Latin all survive. `20260426_162153(0).jpg` lands on disk under its original name, so DB references resolve and the hero portrait no longer 404s into a "double background" broken-image icon. The path-traversal belt-and-braces `path.resolve(...).startsWith(...)` check remains. The one-off `cp` workaround in `tools/import-bundle-local.mts` is no longer needed.

| Field | Value |
|---|---|
| Severity | medium (real content breakage on import) |
| Where | `services/features/Bundle/BundleService.ts:209-219` (`sanitizeAssetName`) |
| Symptom | After importing the funisimo bundle locally, the home-page hero portrait (and any other image whose original filename contained parens / spaces) showed a broken-image icon stacked on top of the portrait tile's background-color — looks like "two backgrounds". |
| Cause | `sanitizeAssetName` replaces every char outside `[a-zA-Z0-9._-]` with `_`. So `20260426_162153(0).jpg` lands on disk as `20260426_162153_0_.jpg`. The DB entries are NOT rewritten, so the page still requests the original name and 404s. The sanitizer is too aggressive — parens, spaces, plus signs, etc. are valid filename chars on every supported filesystem. |
| Fix proposal | Either (A) tighten the sanitizer to only reject security-critical chars (null bytes, control chars, `..` segments, path separators) and leave parens/spaces/plus alone; (B) when the sanitizer renames a file, walk the same JSON structures `collectLocalAssets` walks and rewrite every reference; or (C) keep the sanitizer aggressive but emit `skippedAssets` entries for filenames that needed rename (so the operator sees them). |
| Workaround | One-off `cp <sanitized> <original>` for each affected image after import — see `tools/import-bundle-local.mts` notes. |

## 10. e2e workflow disabled to manual-only

**Status: DEFERRED.** Intentional state, not a bug — the Playwright suite was flaky enough during the rollout to consume more attention than it caught, so it's `workflow_dispatch`-only and runs locally via `npm run e2e`. Re-enabling `pull_request` + `push` triggers gates on first stabilising the suite (chase flakes one by one). That stabilisation is its own piece of work and `.github/workflows/e2e.yml` is outside this chunk's scope; leaving the trigger reduction in place until the suite is reliable is the correct call. Related: README E2E backlog + F8-e2e item.

| Field | Value |
|---|---|
| Severity | low |
| Where | `.github/workflows/e2e.yml`, `on:` triggers |
| Symptom | Playwright suite no longer runs on push or PR; only manual `workflow_dispatch`. |
| Cause | Suite was flaky enough during this rollout to consume more attention than it caught. Deferred to local runs (`npm run e2e`). |
| Fix proposal | Stabilise the suite (chase flakes one by one, mark as `test.skip` or fix), then re-enable `pull_request` + `push` triggers on `e2e.yml`. |

---

## Cross-cutting follow-ups

These aren't bugs in any single file — they're patterns we noticed during the rollout that warrant their own work. **2026-05-14:** the per-issue fixes that these point at are now done (#1, #5); the remaining bullets are still genuinely cross-cutting and stay open as their own future work.

- **Compose-time topology lint** (still open): catch issues 3 and 4 above by validating that every reverse-proxied service shares a network with caddy and uses an IP-literal in healthchecks. Issues #3/#4 themselves are fixed; the *lint* that would prevent a recurrence is not.
- **Section creation tooling for AI authoring** (issue #1 — DONE): `section.update` now upserts on a chosen semantic id when `pageName` is given. The broader "AI builds a page section-by-section" ergonomics are otherwise covered.
- **Bundle export/import tooling**: issue #5 (dev token `admin:bundle` scope) is DONE. Documenting the canonical "pull prod bundle to local for visual iteration" runbook flow in `docs/runbooks/` is still open.
- **Audit triplet enforcement** (still open): issue #9 added `page.touch` as the targeted escape hatch, but the cross-cutting fix — a Mongo middleware / service-level wrapper that stamps on every write so per-service stamp logic can be removed — is unbuilt.
