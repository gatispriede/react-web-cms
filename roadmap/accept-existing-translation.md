# "Accept existing" translation button

**Status:** Shipped inline + Languages table (2026-04-20). Hash-based invalidation + Compare view + keyboard shortcut deferred.

Shipped:
- [TranslationMetaService.ts](../src/Server/TranslationMetaService.ts) — extended `ITranslationMetaEntry` with `acceptedSources?: string[]`; save path preserves the array even when `description`/`context` are empty.
- [InlineTranslationEditor.tsx](../src/frontend/components/common/InlineTranslationEditor.tsx) — "Same as source" checkbox in the Alt-click popup. Auto-ticks when value already equals source. On save: persists value, toggles language in `acceptedSources`.
- [ContentLoader.tsx](../src/frontend/components/Admin/AdminSettings/ContentLoader.tsx) — checkbox rendered beneath each translation input in Site settings → Languages. Input disables when ticked, row's `missing` tag flips to a blue `same as source` tag. Toggle persists optimistically via `TranslationMetaApi.save`; on failure reloads state from authority.

Deferred (not blocking):
- Auto-invalidate on source change via `acceptedSourceHashes` — if the source later changes, the accepted flag should auto-clear.
- Compare-view column showing a muted "accepted" badge distinct from both "translated" and "missing".
- Keyboard shortcut (`Alt+=`).

## Goal

In the translation-editing UI (admin Languages tab + inline Alt-click editor), add a one-click "accept existing / no translation needed" affordance that marks a key as intentionally unchanged from its source without leaving it visually "missing". Motivating case: numbers, dates, proper nouns, single-word technical terms — they're the same in every locale and shouldn't be flagged as work-to-do.

## Design

- New state per key per language: `accepted-as-source` (boolean, stored alongside the translated value in `translationMeta` — see [translations-context-field.md](translations-context-field.md) for the existing meta map).
- UI: a checkbox next to each translation input labelled "Same as source" / "No translation needed". Tick it and the per-key value is stored as the source string verbatim, but a meta flag records the acceptance so:
  - the translation-coverage audit doesn't count it as missing
  - the Compare view can render it in a distinct style (e.g. muted) so reviewers see it was a deliberate choice, not neglect
  - bulk "find missing" tools skip it
- Keyboard shortcut: `Alt+=` (or similar) inside the inline editor to quick-accept.
- Semantics: if the source later changes, the accepted flag auto-clears (the "accepted" decision was against the previous source), and the key flips back to "needs review". Implement via a hash of the source stored alongside the accepted flag.

## Files to touch

- `translationMeta` schema (add `acceptedSource?: boolean`, `acceptedSourceHash?: string`)
- Inline translation editor (`InlineTranslationEditor.tsx`) — add the checkbox + keyboard shortcut
- Languages tab Compare view (`ContentLoaderCompare.tsx` or similar) — add the column
- Translation-coverage audit helpers — treat `acceptedSource: true` + matching hash as "translated"

## Acceptance

- Tick "Same as source" on a key → stored as source; re-opening shows the box ticked
- Audit report no longer lists it as missing
- Edit the source string → accepted flag auto-clears, key shows as "needs review"
- Compare view visually distinguishes accepted-as-source from translated and from missing

## Effort

**S · 2–3 h**
