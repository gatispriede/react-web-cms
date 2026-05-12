---
name: backup-and-disaster-recovery
description: Scheduled Mongo backups (incremental + full), uploads/assets backup, automated restore drill, point-in-time recovery, operator-readable RPO + RTO commitments. Bundle export today is a content snapshot, not a disaster-recovery primitive.
---

# Backup + disaster recovery

## Goal

Today's bundle export = content snapshot (`public/CV/site-2026-05-03.json`). Disaster recovery needs more:

1. **Scheduled Mongo backups** — daily full + 6-hourly incremental — to off-droplet storage (Backblaze B2 / DigitalOcean Spaces / Restic-encrypted)
2. **Uploads / assets backup** — `uploads/images/` rsync to the same off-droplet bucket
3. **Point-in-time recovery** — restore Mongo + uploads to any backup snapshot within retention
4. **Automated restore drill** — weekly CI job that restores the latest backup into a fresh container, runs smoke tests, alerts on failure
5. **RPO + RTO commitments** — Recovery Point Objective (max data loss) ≤ 6h; Recovery Time Objective (max downtime to recover) ≤ 1h
6. **Backup retention policy** — daily for 14 days; weekly for 8 weeks; monthly for 12 months
7. **Operator runbook** — `runbooks/disaster-recovery.md` covering: total droplet loss, partial Mongo corruption, accidental admin delete, GHCR image rollback
8. **Encryption at rest** — backups encrypted with operator-held key; key never lives on the droplet

## Why now

- Single droplet today = single point of failure. SSH lockout / data corruption / hostile actor = total content loss.
- Operator has had a real MongoDB breach + SSH lockout pattern (per the security-research memory). Backups + restore drill = the resilient counterweight.
- Pairs with [terraform-kamal-migration.md](terraform-kamal-migration.md) — Kamal deploys are easy to redo from GHCR, but the **data** layer needs explicit backup.

## Design

### Backup tooling

**Restic** + **Backblaze B2** as the recommended pair:

- Restic: deduplicated, encrypted, append-only repo; widely used + audited
- B2: cheapest off-droplet object storage; $6/TB/month all-in; S3-API-compatible (so swappable later)
- Combined: ~$2-5/month per site at typical content sizes

Alternative: DigitalOcean Spaces if operator wants the bill on the same provider; ~3× more expensive than B2.

### What's backed up

| Source | Strategy | Frequency |
|---|---|---|
| Mongo (full dump) | `mongodump --gzip` → Restic | daily 03:00 local |
| Mongo (oplog tail) | `mongodump --oplog` → Restic | every 6h |
| `uploads/images/` | Restic file-system | every 6h |
| `~/cms/.env` (encrypted) | Restic file-system | daily |
| Caddy certs (`/etc/caddy/`) | Restic file-system | weekly |
| **NOT backed up:** Docker images (GHCR is the source); Caddy logs (rotated); systemd journal (transient) | — | — |

Manifest written to `Backups` Mongo collection after each run (timestamp + restic snapshot id + sizes + sha256).

### Encryption

Restic encrypts everything with a passphrase. Passphrase:

- Stored encrypted at rest in operator's password manager (1Password / Bitwarden)
- Loaded into the droplet's `.env` as `RESTIC_PASSWORD` (env-only, never written to disk in plaintext)
- For B2 credentials: B2 application key with `writeFiles` + `readFiles` only (no `deleteFiles` — append-only)

If droplet is compromised, attacker can append to the backup repo but can't delete history. Restore from any prior snapshot.

### Restore drill — weekly automated

GitHub Actions scheduled workflow `disaster-recovery-drill.yml`:

1. Spin up a fresh container: Mongo 7 + the latest CMS GHCR image
2. Download latest Restic snapshot from B2
3. Restore Mongo dump + uploads
4. Boot the CMS against the restored data
5. Run smoke tests:
   - `/api/health` returns 200 with expected `bootId`
   - Public homepage renders
   - Admin login works
   - At least one product exists; its image loads
   - Bundle export works
6. Compare snapshot age vs RPO target — fail if > 6h
7. Compare drill duration vs RTO target — fail if > 1h
8. Email + Sonner-toast alert on failure

Results written to `BackupDrills` collection; admin pane shows last 30 days of drill health.

### Restore runbook (`runbooks/disaster-recovery.md`)

Operator-readable playbooks per failure mode:

**Total droplet loss:**
1. Provision new droplet via Terraform (`terraform apply`)
2. Install Restic + B2 creds via Kamal secrets
3. Restore latest snapshot: `restic restore latest --target /restore`
4. `mongorestore --gzip /restore/mongo-dump`
5. Move `uploads/images/` into place
6. `kamal deploy` — GHCR pull + container boot
7. Verify health endpoint, smoke-test customer flow
8. RTO target: ≤ 1 hour from droplet-creation

**Partial Mongo corruption (specific collection):**
1. Identify last-good snapshot via `restic snapshots`
2. Restore single collection: `mongorestore --gzip --drop --nsInclude=cms.Posts /restore/mongo-dump`
3. Re-publish via `site_publish` MCP tool
4. Verify

**Accidental admin delete (e.g. wrong page deleted):**
1. First check `*.trash` collections — 24h TTL means it may still be there + `cascadeRestore` works
2. If past 24h: restore from last-good snapshot into a temp Mongo, extract the doc, insert into prod

**GHCR image rollback:**
1. `kamal app boot --version=<previous-sha>` — Kamal-native rollback
2. No data layer needed (Mongo + uploads unchanged)
3. RTO: ~5 min

### Admin pane

`/admin/system/backups` (new):

- **Last backup status** — green/yellow/red, timestamp, size
- **Recent snapshots** — paginated list with sizes + restic snapshot ids
- **Last drill result** — pass/fail + duration + age of snapshot used
- **Manual trigger** — "Backup now" button (operator)
- **Manual restore preview** — "Show what's in snapshot X" (lists collections + counts, doesn't actually restore)
- **Retention policy display** — what's stored, when it auto-deletes
- **Cost estimate** — current B2 spend based on repo size

### Audit + alerting

- Each backup run logs to `Backups` collection
- Each failed run + each drill-fail triggers a Sonner toast on the operator's next admin login + an email via `EmailService.sendTemplated('backupFailure', ...)`
- Audit log captures any manual restore operation (which snapshot, who triggered, what restored)

### Multi-site

When multi-site lands (currently single-site per droplet), backups isolate per-site via Restic tag (`--tag site:funisimo`). Restore tooling filters by tag. No restic-repo-per-site (overhead); single repo with tag-based isolation.

## Files to touch

- `infra/backup/restic-backup.sh` (new) — cron-runnable script
- `infra/backup/restic-restore.sh` (new)
- `infra/backup/Dockerfile.restic` (new — container image with restic + mongo-tools)
- `infra/compose.backup.yaml` (new — sidecar container running cron)
- `services/features/Backups/BackupsService.ts` (new — admin-facing log + status queries)
- `services/features/Backups/BackupsServiceLoader.ts` (new)
- `services/features/Backups/feature.manifest.ts` (new)
- `shared/types/IBackupRun.ts` (new)
- `shared/types/IBackupDrill.ts` (new)
- `ui/admin/features/Backups/Backups.tsx` (new)
- `ui/admin/features/Backups/BackupsAdminUILoader.ts` (new)
- `.github/workflows/disaster-recovery-drill.yml` (new — weekly scheduled)
- `runbooks/disaster-recovery.md` (new — operator playbook)
- `services/features/Mcp/tools/backups.ts` (new — `backup_runNow`, `backup_list`, `backup_inspect`, `backup_restore` (advanced-only + double-confirm), `backup_setRetention`, `backup_drillResult`)
- Tests: backup-script smoke (against MockDB), drill workflow on fixture data, audit logging

## Starter code

`infra/backup/restic-backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

LOG_TAG="restic-backup-$(date -u +%Y%m%d-%H%M%S)"
echo "[$LOG_TAG] starting"

# 1. Mongo dump
DUMP_DIR=$(mktemp -d)
trap "rm -rf $DUMP_DIR" EXIT

mongodump \
    --uri="$MONGO_URI" \
    --gzip \
    --oplog \
    --out="$DUMP_DIR/mongo" \
    --quiet

# 2. Restic backup of dump + uploads + env + caddy
restic --repo "$RESTIC_REPO" backup \
    "$DUMP_DIR/mongo" \
    "$UPLOADS_DIR" \
    "$ENV_FILE" \
    "$CADDY_CONFIG_DIR" \
    --tag "site:$SITE_TAG" \
    --tag "kind:scheduled" \
    --host "$HOSTNAME"

# 3. Prune per retention policy (daily 14, weekly 8, monthly 12)
restic --repo "$RESTIC_REPO" forget \
    --keep-daily 14 \
    --keep-weekly 8 \
    --keep-monthly 12 \
    --prune \
    --tag "site:$SITE_TAG"

# 4. Record manifest in Mongo
NEW_SNAPSHOT=$(restic --repo "$RESTIC_REPO" snapshots --latest 1 --json --tag "site:$SITE_TAG" | jq -r '.[0].id')
mongosh "$MONGO_URI" --eval "db.Backups.insertOne({snapshotId: '$NEW_SNAPSHOT', kind: 'scheduled', completedAt: new Date(), tag: '$SITE_TAG'})"

echo "[$LOG_TAG] done: $NEW_SNAPSHOT"
```

Cron via systemd or compose sidecar (operator picks during install).

## Acceptance

1. Daily full + 6-hourly oplog backups run automatically; written to B2 via Restic
2. Uploads + env + Caddy config backed up alongside Mongo
3. Restic repo encrypted; key not on droplet (env-only)
4. Retention policy enforces 14d / 8w / 12m
5. Weekly automated restore drill spins up fresh container, restores, smoke-tests
6. Drill failure triggers Sonner toast + email alert
7. Admin pane shows backup status + drill history + manual trigger
8. `runbooks/disaster-recovery.md` covers 4 failure modes (total loss / partial Mongo / admin error / image rollback) with copy-pasteable commands
9. RPO ≤ 6h verified by drill; RTO ≤ 1h verified by drill duration
10. MCP coverage: `backup_*` tools (restore gated as advanced + double-confirm)
11. Multi-site tagging in place for the future
12. Cost estimate visible in admin pane

## Effort

**L · ~5-6h AI.**

- Backup script + cron / sidecar: ~1h
- Restore script + runbook playbooks: ~1h
- Admin pane + status queries: ~1h
- Drill workflow: ~1.5h
- MCP tools + tests: ~1h
- Documentation polish: ~30 min

Wall-clock: B2 account setup + key provisioning (operator, ~30 min).

## Dependencies

- [terraform-kamal-migration.md](terraform-kamal-migration.md) — droplet provisioning is reproducible via Terraform (already shipped for funisimo)
- Existing `Audit` feature (shipped)
- B2 account + application key (operator setup)

## Open questions

- **[OPERATOR DECISION]** Backup provider — Backblaze B2 (recommended; cheapest, S3-compatible) vs DigitalOcean Spaces (same provider, slightly pricier) vs AWS S3 (most expensive, most flexible). Recommend: B2.
- **[OPERATOR DECISION]** RPO target — 6h (recommended) vs 1h (more aggressive). Recommend: 6h; 1h requires near-realtime oplog tailing + costs more in B2 PUT operations.
- **[OPERATOR DECISION]** Drill frequency — weekly (recommended) vs daily. Recommend: weekly; daily drill cost outweighs benefit at single-droplet scale.
- **[OPERATOR DECISION]** Operator-key custody — manual password-manager (recommended for POC) vs HashiCorp Vault / AWS KMS. Recommend: password manager now; KMS pre-public-deploy.

## Out of scope

- Geographic-redundant Mongo cluster (multi-region replica set) — separate item; cost-justified only at multi-droplet scale
- Live failover (active-passive Mongo replica + Caddy upstream rotation) — separate item
- Cold-storage archive (Glacier / Deep Archive) for compliance — separate item once retention requirements exceed B2's pricing curve
- Backup of GHCR images themselves — GHCR is the source of truth; images can always be rebuilt from source
- Per-customer data backup independent of platform backup — covered by GDPR data export ([gdpr-privacy-consent.md](../storefront/gdpr-privacy-consent.md))
