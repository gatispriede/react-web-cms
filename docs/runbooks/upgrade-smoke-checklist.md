# Upgrade smoke checklist

Operator runs this on each droplet **after** the blue/green flip (Step 4 of [upgrade-droplets.md](upgrade-droplets.md)). Tick every box. Stop and escalate at the first failure.

`<domain>` = the droplet's apex domain. `<token>` = a valid admin bearer token.

## Build identity

- [ ] `curl -fsS https://<domain>/api/info | jq -r .sha` returns the new commit SHA (matches the deploy ticket).
- [ ] `curl -fsS https://<domain>/api/info | jq -r .build` returns a fresh ISO timestamp (within the last hour).
- [ ] `curl -fsS -I https://<domain>/api/health` returns `HTTP/2 200`.

## Routes (F3 cancelled — see [v1-url-namespace.md](../roadmap/v1-url-namespace.md) postmortem)

- [ ] `curl -fsS -I https://<domain>/admin/build` → `HTTP/2 200` or `302` to login.
- [ ] `curl -fsS -I https://<domain>/api/graphql` → `HTTP/2 200` (or method-not-allowed for HEAD; either acceptable).
- [ ] `curl -fsS https://<domain>/sitemap.xml` returns XML (rewrite resolves through `/api/...`).
- [ ] `curl -fsS https://<domain>/robots.txt` returns text body.

## Customer slug isolation (no collision with admin/api)

- [ ] In a tenant that has a customer page with slug `about-us` in locale `lv`: `curl -fsSL https://<domain>/lv/about-us` returns the customer's HTML, **not** an admin redirect.
- [ ] If a customer page exists with literal slug `admin` or `api`, visit `/<lang>/admin` and `/<lang>/api` — customer pages render. The 308 rule only fires on top-level `/admin/...` and `/api/...`.

## OAuth sign-in (NextAuth)

- [ ] In a clean browser window, visit `https://<domain>/admin`. Expect a redirect to the OAuth provider, then back to `/admin` after consent.
- [ ] Verify the callback URL in the provider's OAuth round-trip is `<NEXTAUTH_URL>/api/auth/callback/<provider>`. (Inspect the `redirect_uri` query param on the provider's consent screen.)
- [ ] Existing pre-deploy admin user can sign in. Their session lands on the new admin shell.
- [ ] Sign out works. Lands on the public site.

## F2 — cascade engine + soft-delete to `*.trash`

Pick a known throwaway test page on the droplet (or import a fresh one via bundle).

- [ ] `mongosh` shows the test page in the `pages` collection.
- [ ] Delete the test page through the admin UI (`/admin/pages` → delete).
- [ ] `mongosh`: `db.getCollectionNames().filter(n => n.endsWith('.trash'))` includes `pages.trash` (lazily created on first delete).
- [ ] `db.pages.trash.findOne({_id: <testPageId>})` returns the deleted page with a `deletedAt` timestamp.
- [ ] TTL index exists: `db.pages.trash.getIndexes()` includes one with `expireAfterSeconds: 86400`.
- [ ] Cascade: any sections that belonged exclusively to the test page also moved to `sections.trash`.
- [ ] Restore from trash through the admin UI. Page reappears in `pages` and cascade-linked sections reappear in `sections`.

## F1 — sub-pages with optional `parent` + `slug`

- [ ] An existing page with **no** `parent` field renders correctly under its slugified-from-`page` URL. (Pick any pre-deploy page: `curl -fsS -I https://<domain>/<lang>/<existing-slug>` → `200`.)
- [ ] Create a new sub-page under the test page via `/admin/pages` (set parent = test page). The sub-page resolver chains `<parent-slug>/<child-slug>` and renders.
- [ ] The sub-page UI defaults to "root" for every existing pre-deploy page.

## Per-locale slugs

- [ ] An existing page with a bare-string `slug` (legacy shape) still resolves. Confirm with a known pre-deploy URL.
- [ ] Editing the slug in the admin and selecting per-locale variants persists as `Record<LocaleCode, string>`. Confirm in `mongosh` that the document now stores an object.
- [ ] After per-locale edit, both `/lv/<lv-slug>` and `/it/<it-slug>` resolve to the same page in the right locale.

## F5 — admin info page

- [ ] Navigate to `/admin/system/info`. All 7 sections render without error: build, db, cache, queue, features, geo, runtime.
- [ ] Each section shows non-empty data (no permanent spinners, no "—" placeholders for required fields).

## Grant-gated mutations (functional roles only)

- [ ] An admin-rank user (existing pre-deploy admin) can perform any of the 30 grant-gated mutations without an explicit grant — admin rank bypasses.
- [ ] A functional-role user *without* the relevant grant gets a 403 from the same mutation. (Skip if no functional-role user exists on the droplet.)

## AUI panes

- [ ] An existing pre-deploy admin user lands in **advanced** AUI mode (the default for upgrade users).
- [ ] `setMyAdminUiMode` toggles to simplified and back without a reload.

## Bundle import + idempotency

- [ ] Bundle-import a known test bundle through `/admin/bundles` (or POST to `/api/import`). First import succeeds (200 with `{ok: true}`).
- [ ] Re-submit the same bundle (same content, same idempotency key). Second submission returns the cached result without duplicating data — Redis idempotency namespace served the response.
- [ ] Confirm the dry-run script (`tools/scripts/upgrade-dry-run.sh <bundle>`) ran green against this same bundle locally before this deploy.

## Caddy SWR cache eviction

- [ ] Trigger an admin write (edit any page).
- [ ] Re-fetch the same public page. The `X-Cms-Cache-Tag` header reflects the bumped feature version.

## Compose health

- [ ] `docker compose ps` on the droplet shows `app` (or `app-blue` / `app-green` whichever is now active) as `healthy` within 90 s of the flip.
- [ ] `docker compose logs --tail 200 app` shows no panic / crash loop.

## Final

- [ ] All boxes above ticked. Sign off in the deploy ticket with timestamp.
- [ ] If any box failed: abort. Follow Step 5 (Rollback) in [upgrade-droplets.md](upgrade-droplets.md).
