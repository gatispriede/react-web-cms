# Runbook — Upgrading existing prod droplets to the new master

Audience: ops upgrading the 2 existing prod droplets running pre-F3 code to the new master that ships F1 (sub-pages), F2 (cascade engine + soft-delete), F5 (admin info), per-locale slugs, grant-gated mutations, simplified AUI panes, and the Redis idempotency namespace. (F3 `/v1/**` namespace was cancelled — see [v1-url-namespace.md](../roadmap/platform/v1-url-namespace.md) postmortem.)

Cross-links:
- [v1-namespace-migration.md](v1-namespace-migration.md) — what changed in F3 and how to verify.
- [seamless-deployment.md](seamless-deployment.md) — the blue/green flip mechanism.
- [upgrade-smoke-checklist.md](upgrade-smoke-checklist.md) — the post-deploy checkbox list.
- `tools/scripts/upgrade-dry-run.sh` — automate the local rehearsal before touching prod.

## Migration mental model

The new master is **forward-compatible by construction** for stored data:
- F1 sub-pages: missing `parent`/`slug` fields fall through; the resolver slugifies `page` for legacy rows.
- F2 trash: `*.trash` collections are created lazily on first delete with a 24 h TTL index.
- Per-locale slugs: resolver accepts `string | Record<LocaleCode, string>`.
- Grants: existing admin-rank users bypass the 30 grant gates by rank.
- AUI panes: existing users keep advanced unless they flipped via `setMyAdminUiMode`.
- Idempotency: first write is always idempotent (Redis namespace is empty).

Pre-flight ops work:
1. **OAuth provider callback URLs** — must be allowlisted *before* deploy.
2. **External webhook URLs** — no changes (F3 was cancelled; routes stay at `/api/...`).
3. **Bookmark expectations** — internal team should know `/admin/...` redirects to `/admin/...`.

## Why bundle, not mongodump

This runbook uses the **bundle round-trip** (`/api/export` → JSON → `/api/import`) for both backup and dry-run. Reasons:

- The bundle is the unit the app already exports/imports through the admin UI ("Release → Bundle"). It's a tested code path — see `services/features/Bundle/BundleService.test.ts` (6+ tests covering manifest, schema versions, idempotent re-import).
- No `mongodump`/`mongorestore` tooling required on operator workstations.
- Local rehearsal is **atomic**: drop local Mongo, boot fresh, import bundle, walk smoke. Same artifact prod will receive on rollback.
- Smaller scripts (no BSON archive handling, no auth-source juggling).

## Step 1 — Pre-flight (run 1–2 days before deploy)

### 1a. OAuth provider callback URLs

F3 was cancelled — OAuth callbacks stay at `/api/auth/callback/<provider>`. No action required for callback URLs as part of this upgrade.

| Provider | Old callback (keep) | New callback (add) |
|---|---|---|
| Google | `<NEXTAUTH_URL>/api/auth/callback/google` | `<NEXTAUTH_URL>/api/auth/callback/google` |
| GitHub | `<NEXTAUTH_URL>/api/auth/callback/github` | `<NEXTAUTH_URL>/api/auth/callback/github` |
| Any other | `<NEXTAUTH_URL>/api/auth/callback/<provider>` | `<NEXTAUTH_URL>/api/auth/callback/<provider>` |

`<NEXTAUTH_URL>` is the apex of the droplet (`https://<domain>`). Confirm by running on the droplet:

```bash
grep '^NEXTAUTH_URL=' /opt/cms/.env
```

Verify each provider's saved configuration **after** the change in the provider's UI. Do not skip — sign-in breaks for every admin if a provider is missing the new URL.

### 1b. External webhook audit

Per droplet, list every external system that POSTs to `/api/...`:

- **Stripe** — webhook destinations in dashboard. Stripe follows 308 with body intact; safe to defer.
- **Resend** — mail/event webhooks. Same: Resend follows 308.
- **Uptime monitors** (UptimeRobot, BetterStack, Pingdom, etc.) — confirm probe URL.
- **Internal CI/CD** that hits `/api/health` or `/api/info`.
- **Anything custom** the customer team set up.

Document old + new endpoints in the droplet's deploy ticket.

### 1c. Team announcement

Post in the internal channel: "`/admin/*` URLs redirect to `/admin/*` after the next deploy. Re-bookmark from your address bar after the first visit. If you see sign-in failures, check that your provider config has the new callback URL."

### 1d. Local dry-run

Pull a fresh prod bundle (still on the *old* build, so the export endpoint is the legacy `/api/export` — the new build's `/api/export` is equivalent and will be available post-deploy):

```bash
TS=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p backups
curl -fsSL -H "Cookie: $ADMIN_COOKIE" \
     "https://<domain>/api/export" \
     -o "backups/predeploy-$TS.bundle.json"
jq '.manifest, (.site|keys|length)' "backups/predeploy-$TS.bundle.json"
```

Then rehearse against the new build locally:

```bash
bash tools/scripts/upgrade-dry-run.sh "backups/predeploy-$TS.bundle.json"
```

This boots the new build on a non-default port against a clean local Mongo, imports the prod bundle through `/api/import`, and walks every smoke check. Green = safe. Red = stop and investigate.

For a CI-friendly self-check that validates the script's pre-conditions without booting anything:

```bash
bash tools/scripts/upgrade-dry-run.sh --check-only
```

## Step 2 — Backup

On the operator workstation (not the droplet — bundles are app-level and the operator already has admin auth):

```bash
TS=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p backups
curl -fsSL -H "Cookie: $ADMIN_COOKIE" \
     "https://<domain>/api/export" \
     -o "backups/predeploy-$TS.bundle.json"
test -s "backups/predeploy-$TS.bundle.json" && \
  jq -e '.manifest.exportedAt' "backups/predeploy-$TS.bundle.json"
```

Retention: keep the last 7 daily bundles + the last 4 weekly ones in object storage. Bundles are JSON; gzip cuts ~80%.

If you cannot reach the running app for any reason, fall back to a Mongo-side export from the droplet — but treat that as exceptional. The bundle is the canonical artifact.

## Step 3 — Deploy

Use the existing blue/green flip per [seamless-deployment.md](seamless-deployment.md). Summary:

```bash
cd /opt/cms
git pull origin master
docker compose pull
bash tools/blue-green-deploy.sh   # builds new image into idle slot, health-checks, flips
```

While the new slot is up but **not yet flipped to active**, smoke-test against the new slot's port directly (8081 or 8082, whichever is idle):

```bash
curl -fsS http://localhost:8081/api/info | jq -r .sha
curl -fsS -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8081/admin/system/info | jq .
```

Both should return the new commit SHA and a complete F5 admin-info payload (7 sections: build, db, cache, queue, features, geo, runtime).

If both pass, proceed with the flip. If either fails, abort — do not flip.

## Step 4 — Post-deploy verification

Walk every step in [upgrade-smoke-checklist.md](upgrade-smoke-checklist.md). Tick each box.

If any check fails, escalate — do not declare deploy successful.

## Step 5 — Rollback

If post-deploy verification fails irrecoverably:

```bash
cd /opt/cms
bash tools/blue-green-deploy.sh --rollback
```

If data has drifted (a customer made a write between flip and rollback) and you need to restore content from the bundle:

```bash
# Re-import the predeploy bundle through the OLD build's /api/import.
curl -fsS -X POST \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  --data-binary @backups/predeploy-$TS.bundle.json \
  "https://<domain>/api/import"
```

Bundle import is idempotent on identical input (Redis idempotency namespace + content hashing). Imports are also additive by default — confirm the BundleService import semantics for your tenant before relying on it for a full restore. For a destructive restore, drop the affected collections in `mongosh` first, then re-import.

Rollback considerations:
- **OAuth providers must still allow the old `/api/...` callback** during the rollback window. Do NOT drop the old callback URL until after Step 6.
- The 308 redirects in `next.config.js` were the only persistence-affecting runtime change in F3 — rolling back removes them, customer URLs were untouched.
- `*.trash` collections created by F2 during the brief new-build window are inert under the old build (it doesn't read them).

## Step 6 — Drop-the-redirect (next deploy after the window)

Wait at least one full release cycle (≥ 3 consecutive days with zero hits in the legacy-route observability panel — see [v1-namespace-migration.md § When to drop the 308 redirects](v1-namespace-migration.md#when-to-drop-the-308-redirects)).

When the criteria are met:

1. Update remaining external webhooks (Stripe, Resend, uptime monitors) from `/api/...` to `/api/...`.
2. Drop the old `/api/auth/callback/<provider>` URL from each OAuth provider dashboard.
3. Delete from `ui/client/next.config.js`:
   ```js
   {source: '/admin', destination: '/admin', permanent: true}
   {source: '/admin/:path*', destination: '/admin/:path*', permanent: true}
   {source: '/api/:path*', destination: '/api/:path*', permanent: true}
   ```
4. Re-deploy via the same blue/green flow.
5. Smoke: `curl -I https://<domain>/admin/build` → expect `404`. By design.

Document the cutover date in the droplet's deploy ticket and announce in the internal channel.

## Recommended deploy order for the 2 droplets

Deploy the **lower-traffic droplet first** as a canary. Wait at least 24 h (one diurnal traffic cycle) before deploying the second. Watch the legacy-route observability panel and OAuth sign-in success rate during the canary window. If either degrades, abort the second deploy and rollback the first.

Rationale for the order:
- Canary droplet absorbs any unexpected client-side regression (admin shell, OAuth callback edge cases) without taking down the busier tenant.
- 24 h covers a full daily cycle including the weekday morning admin-login peak — the most likely time for OAuth-config bugs to surface.
- If the busier droplet sees more diverse customer slugs, deploying it second means F1/F2 edge cases on those slugs hit a known-good build.
