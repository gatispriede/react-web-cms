# Debt — ghost navigation cleanup **Closed**

Root cause was fixed upstream (the old `updateNavigation` path no longer upserts bare `{page, sections}` rows). New installs never accumulate ghosts, so there's no ongoing debt — only pre-fix databases need the existing script run once.

**Tooling now in place:**

- [`Scripts/cleanup-ghost-navigation.ts`](../Scripts/cleanup-ghost-navigation.ts) — dry-run by default; `--apply` to delete.
- [`mongoDBConnection.warnOnGhostNavigations`](../src/Server/mongoDBConnection.ts) — logs a one-shot visibility warning on first Mongo connect when ghosts are present: `[cleanup] N ghost Navigation docs detected. Run: npx tsx … Scripts/cleanup-ghost-navigation.ts --apply`. No silent deletion at boot — that would be a worse failure mode than a persistent log line.

**Operator workflow on legacy databases:**

1. Take a Mongo dump first (see `DEPLOY.md` backup section).
2. Dry-run: `npx tsx --tsconfig src/Server/tsconfig.custom.json Scripts/cleanup-ghost-navigation.ts`
3. Review the list. If unexpected entries show up, investigate — they may predate the type marker convention.
4. Apply: `npx tsx --tsconfig src/Server/tsconfig.custom.json Scripts/cleanup-ghost-navigation.ts --apply`
5. Verify the boot warning no longer appears.

Script is idempotent — a second run on a clean database is a no-op.

---

*Original plan below for history.*

## Goal

Run the existing cleanup script against prod data and drop any residual ghost `Navigation` docs (entries with no corresponding page/sections).

## Design

Script already exists: `Scripts/cleanup-ghost-navigation.ts`

- Default mode: dry-run — lists ghosts without deleting
- `--apply`: performs the delete

## Steps

1. Take a Mongo dump first (see `DEPLOY.md` backup section)
2. Run dry-run: `npm run ts-node Scripts/cleanup-ghost-navigation.ts`
3. Review the list. If unexpected entries show up, investigate before applying.
4. Run `npm run ts-node Scripts/cleanup-ghost-navigation.ts -- --apply`
5. Verify admin Navigation list matches expectations

## Acceptance

- Dry-run after apply reports zero ghosts
- Nothing unexpected disappeared — spot-check a few pages
- Backup is retained for 14 days before deleting

## Risks / notes

- One-shot cleanup. If ghosts keep reappearing, there's an upstream bug — fix the source instead of re-running this periodically.

## Effort

**XS · < 1 h**

- Backup: 10 min
- Dry-run + review: 10 min
- Apply + verify: 10 min
