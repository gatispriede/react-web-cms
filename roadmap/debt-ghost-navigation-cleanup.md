# Debt — ghost navigation cleanup

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
