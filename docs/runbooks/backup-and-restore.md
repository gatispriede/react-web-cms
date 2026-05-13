# Backup + restore runbook (W8e)

This runbook covers the four failure modes the W8e spec calls out. Every
section is copy-pasteable; commands assume the operator is SSH'd onto
the droplet and the `cms` service is running under `kamal` / docker.

> **Operator setup (one time, before any backup runs):**
>
> 1. Create a Backblaze B2 bucket (private, default region — typically `us-west-002`).
> 2. Create a B2 application key scoped to that bucket with the capabilities
>    `listFiles`, `readFiles`, `writeFiles` — **NOT** `deleteFiles`.
>    An append-only key means a compromised droplet can write new
>    snapshots but cannot wipe history. `restic prune` from a separate
>    operator key handles deletion.
> 3. Generate a passphrase: `openssl rand -base64 32`. Save in
>    Bitwarden / 1Password / Vault — losing it loses the entire backup
>    history (the repo is encrypted client-side).
> 4. Drop the four B2 vars + `BACKUP_RESTIC_PASSWORD` into the droplet's
>    `.env` (NEVER commit) and flip `BACKUP_ENABLED=true`.
> 5. Initialise the restic repo (one time):
>    ```bash
>    docker compose exec cms restic init
>    ```
>    `restic init` is idempotent; running it against an already-initialised
>    repo errors out without doing damage.
> 6. Trigger the first backup from the admin pane (`/admin/system/backups`
>    → "Backup now") or via MCP: `backup.now`.

---

## RPO + RTO

| Metric | Target | How it's enforced |
|---|---|---|
| **RPO** (max data loss) | ≤ 6 hours | `BACKUP_SCHEDULE_HOURLY=0 */6 * * *` runs every 6h. |
| **RTO** (max downtime) | ≤ 1 hour | Weekly drill (`tools/scripts/restore-drill.mjs`) fails if total time > 60 min. |

The weekly drill restores the latest snapshot into a sidecar Mongo on
port 27027, runs `db.users.countDocuments({})` + `db.pages.countDocuments({})`,
and writes a row into the `Backups` collection (`kind: 'drill'`). The
admin pane surfaces the last drill in the status card.

---

## Failure mode 1 — Mongo data corrupted

Symptoms: queries return empty / wrong rows, error logs show
`MongoServerError` on previously-fine collections, customers report
content disappearing.

**Steps:**

```bash
# 1) Stop the application so no further writes happen.
kamal app stop                       # or: docker compose stop cms

# 2) List recent snapshots; pick the one BEFORE the corruption.
docker compose run --rm cms restic snapshots --tag cms

# 3) Restore into a staging dir on the droplet.
docker compose run --rm \
    -v /var/cms-restore:/restore \
    cms restic restore <snapshot-id> --target /restore

# 4) Drop + replace the broken collections from the dump.
#    --drop wipes the target collection first, --nsInclude scopes the
#    restore to one collection at a time so you can be surgical.
mongorestore --uri "$MONGODB_URI" --gzip --drop \
    --nsInclude='MAIN-DB.Pages' \
    /restore/tmp/cms-backup-*/mongo

# 5) Repeat step 4 for every collection that needs replacement.

# 6) Resume the app.
kamal app start
```

> **Operator action:** verify the restored collections by hitting the
> public site + the admin pane before resuming customer traffic.

---

## Failure mode 2 — Site totally wiped (droplet reset, ransomware, lost disk)

Symptoms: the droplet is unreachable or has been provisioned from
scratch. Mongo + uploads + container state are all gone.

**Steps:**

```bash
# 1) Provision a fresh droplet via Terraform.
cd terraform/ && terraform apply

# 2) Install restic + docker on the new droplet (cloud-init covers this
#    in the canonical terraform spec; manual fallback below).
apt-get install -y restic mongodb-database-tools docker.io

# 3) Drop the four B2_* vars + BACKUP_RESTIC_PASSWORD into the droplet
#    .env. The restic password lives in your password manager — paste
#    it in by hand; do NOT scp.
nano /home/cms/.env

# 4) Restore the latest snapshot.
restic snapshots                              # confirm repo readable
restic restore latest --target /restore

# 5) Move uploads back into place.
mv /restore/home/cms/uploads /home/cms/uploads
chown -R cms:cms /home/cms/uploads

# 6) Restore Mongo.
docker compose up -d mongo
mongorestore --uri "$MONGODB_URI" --gzip --drop /restore/tmp/cms-backup-*/mongo

# 7) Deploy the application image.
kamal deploy

# 8) Verify health.
curl -fsS https://<site>/api/health
```

> **Operator action — security follow-up:** if the wipe was hostile
> (ransomware, hostile actor), ALSO complete failure mode 4 below before
> declaring recovery complete. The B2 keys may have leaked.

---

## Failure mode 3 — Bad migration deployed

Symptoms: a recent deploy ran a destructive migration that mangled
schema or data. The app boots but content is wrong.

**Steps:**

```bash
# 1) Find the snapshot from BEFORE the migration ran.
#    --tag scheduled-hourly filters to the cron-written rows; the time
#    column shows UTC.
restic snapshots --tag cms

# 2) Roll the GHCR image back to the pre-migration sha. This stops
#    further damage even if you haven't restored data yet.
kamal app boot --version=<previous-sha>

# 3) Restore the pre-migration snapshot into a staging dir.
restic restore <snapshot-id> --target /tmp/cms-pre-migration

# 4) For each affected collection, restore from the dump.
mongorestore --uri "$MONGODB_URI" --gzip --drop \
    --nsInclude='MAIN-DB.<collection>' \
    /tmp/cms-pre-migration/tmp/cms-backup-*/mongo

# 5) Re-publish through the CMS so caches drop.
#    From the admin pane: System → Publishing → "Publish now".
#    Or via MCP: `site.publish`.

# 6) Clean up the staging dir.
rm -rf /tmp/cms-pre-migration
```

> **Operator action:** after recovery, write a postmortem identifying
> which migration step caused the regression and add a guard to
> `services/features/<feature>/migrations/`.

---

## Failure mode 4 — B2 bucket compromised

Symptoms: B2 portal shows requests from an unexpected IP, the
`BACKUP_RESTIC_PASSWORD` was leaked, or a hostile process on the droplet
had access to the env file.

**Steps:**

```bash
# 1) IMMEDIATELY revoke the B2 application key in the B2 portal:
#    https://secure.backblaze.com/app_keys.htm
#    The active backup may fail mid-flight — that's intentional.

# 2) Create a NEW B2 application key with the same capabilities
#    (listFiles + readFiles + writeFiles, NOT deleteFiles).

# 3) Rotate the restic passphrase. Restic supports passphrase
#    rotation in-place without re-encrypting the existing data:
restic key add                  # interactive — enter the NEW passphrase
restic key list                 # confirm both keys present
restic key remove <old-key-id>  # drop the leaked passphrase

# 4) Update the droplet .env with the new B2 key + restic passphrase
#    and restart the cms container.
nano /home/cms/.env
kamal app restart

# 5) Verify integrity of the existing repo against the new key.
restic check --read-data-subset=10%

# 6) Trigger an immediate fresh snapshot so the next restore drill has
#    a known-good baseline.
restic backup ... # via `backup.now` admin pane button or MCP tool

# 7) Audit the AuditLog for any unauthorised access:
mongo --eval 'db.AuditLog.find({"actor.email":{$exists:true}}).sort({at:-1}).limit(200).pretty()'
```

> **Operator action — disclosure:** if customer data may have been
> exposed (the backup repo contains a full Mongo dump), engage the
> incident response runbook in parallel.

---

## Restore drill — automated

The weekly drill lives at `tools/scripts/restore-drill.mjs`. Schedule it
from cron (operator droplet) or GitHub Actions:

```yaml
# .github/workflows/restore-drill.yml (example)
on:
  schedule:
    - cron: '0 4 * * SUN'      # Sundays 04:00 UTC
jobs:
  drill:
    runs-on: ubuntu-latest
    services:
      mongo:
        image: mongo:7
        ports: ['27027:27017']
    steps:
      - uses: actions/checkout@v4
      - run: sudo apt-get install -y restic mongodb-database-tools mongosh
      - run: node tools/scripts/restore-drill.mjs
        env:
          B2_ACCOUNT_ID: ${{ secrets.B2_ACCOUNT_ID }}
          B2_APPLICATION_KEY: ${{ secrets.B2_APPLICATION_KEY }}
          B2_BUCKET_NAME: ${{ secrets.B2_BUCKET_NAME }}
          BACKUP_RESTIC_PASSWORD: ${{ secrets.BACKUP_RESTIC_PASSWORD }}
          BACKUP_DRILL_PORT: 27027
          BACKUP_DRILL_REPORT_URL: ${{ secrets.BACKUP_DRILL_REPORT_URL }}
```

The drill exits non-zero on failure; GitHub Actions will email the
repo's notification list. The result also lands in `BACKUP_DRILL_REPORT_URL`
(a POST endpoint that records into the `Backups` collection) so the
admin pane surfaces a red badge if the last drill failed.

---

## Audit trail

Every backup, verify, and restore call writes a row into `AuditLog` via
`AuditService.record`. Query recent backup activity with:

```bash
mongo --eval 'db.AuditLog.find({collection:"Backups"}).sort({at:-1}).limit(50).pretty()'
```

---

## Reference

- BackupService: `services/features/Backup/BackupService.ts`
- Cron registration: `services/features/Backup/BackupScheduler.ts`
- Admin pane: `ui/admin/features/Platform/BackupPanel.tsx`
- Restore drill: `tools/scripts/restore-drill.mjs`
- MCP tools: `backup.list` / `backup.now` / `backup.verify` /
  `backup.restoreToStaging` / `backup.lastDrillResult`
- Spec: `docs/roadmap/platform/backup-and-disaster-recovery.md`
