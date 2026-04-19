# Debt — sanitizeKey v2 migration

## Goal

`sanitizeKey` (v1) has a regex bug — the character class closes early on `]`, so most specials survive as-is. `sanitizeKeyV2` next to it has the correct class. Migrate new keys to v2, back-fill existing ones with a one-shot script, drop v1.

## Design

- New keys always go through `sanitizeKeyV2`. Every call site currently using `sanitizeKey` flips over in one commit.
- Existing translations live in Mongo under the v1-sanitised key. Rather than rewriting them in-place (risky, easy to double-escape), write a one-shot script that:
  1. Reads every translation entry
  2. Re-sanitises the key with v2
  3. If the new key differs, copies the entry to the new key, leaves the old in place
  4. After one or two releases where we confirm nothing reads the old keys, a second pass deletes them
- Tests in `helpers.test.ts` already lock both behaviours. Don't delete v1 until the cleanup script has been run in prod.

## Files to touch

- `src/utils/stringFunctions.ts` — remove v1 once migration is complete
- Every call site of `sanitizeKey` — flip to `sanitizeKeyV2`
- `Scripts/migrate-translation-keys.ts` (new) — dry-run by default; `--apply` to write
- `src/utils/helpers.test.ts` — after v1 removal, collapse dual tests
- `DEPLOY.md` — document running the migration script during upgrade

## Acceptance

- `grep -rn 'sanitizeKey' src/` shows only v2 (or the deprecated re-export for transition)
- Dry-run on prod data reports the exact number of entries that need rekeying
- `--apply` run does the copy; subsequent dry-run reports zero changes needed
- Translation UI Compare view shows both old and new keys during transition, only new keys after cleanup pass

## Risks / notes

- Absolutely no in-place key mutation in pass 1. Copy, don't move. A failed run must be a no-op from the editor's perspective.
- Watch for translations stored outside the main collection (settings, sections with localised strings). Grep thoroughly before running.

## Effort

**M · 4–6 h**

- Call-site migration: 1 h
- Migration script + dry-run output: 2 h
- Backup + prod dry-run + apply: 1 h
- Second-pass cleanup planning + docs: 1 h
