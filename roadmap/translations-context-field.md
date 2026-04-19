# Translations — per-key context / description — **Shipped**

Backend `TranslationMetaService` + `getTranslationMeta`/`saveTranslationMeta` GraphQL fields under `mongo` (editor role); frontend `MetaCell` popover in [`ContentLoaderCompare`](../src/frontend/components/Admin/AdminSettings/ContentLoaderCompare.tsx) with optimistic update + revert-on-error. Entries auto-prune when both `description` and `context` are cleared. Round-trip verified end-to-end via the live GraphQL endpoint.

## Goal

Translators see *why* a key exists and where it appears before translating. Today they see a bare sanitised key (e.g. `home_hero_cta`) and have to guess.

## Design

- Add a single JSON map on `SiteSettings`: `{[key: string]: {description?: string; context?: string}}`.
- `description`: short, shown next to the key in the Compare view.
- `context`: longer, shown in a hover popover or inline when the row is expanded.
- Map is flat — same sanitised-key space the translations already use. No per-language context (context is source-language-neutral).
- Editing happens inline in the Compare view: expandable "✎" icon next to each key opens a small textarea that patches the map.

## Files to touch

- `src/Server/SiteSettingsService.ts` (or equivalent): read/write the `translationMeta` field
- `src/frontend/components/Admin/Translations/Compare*.tsx`: expand row, textarea, save-on-blur
- `src/Interfaces/ISiteSettings.ts` (or nearest): field typing
- GQty schema regen OR manual patch (see `debt-gqty-regenerate.md`)

## Acceptance

- Adding a description to `home_hero_cta` shows it in every row of the Compare view from next reload
- Context survives language edits — we only touch the meta map, never the translations
- Empty description/context doesn't render the "✎" as if something exists — keep the affordance subtle
- No `MongoDB` writes on focus/blur with no change (cheap local diff before save)

## Risks / notes

- Tempting to store meta *per language*. Don't — leads to drift and doubles editor work.
- If the map grows past a few hundred keys, consider a separate collection. Not now.

## Effort

**S–M · 2–4 h**

- Backend field + API: 30 min
- Compare UI — expand + textarea + autosave: 1–2 h
- GQty patch or regen: 30 min – 1 h
- Eyes-on testing across a few real keys: 30 min
