# Translations — inline on-page editing

## Goal

Click any translatable string on the rendered public site (while logged in as editor) → small popover with a text input → save → live update. No more round-trip through the Translations tab for a typo fix.

## Design

### DOM tagging

- Every string that flows through `translateOrKeep` (and the other translation helpers) gets wrapped with a `<span data-i18n-key="…">` in admin mode. In viewer / public mode the wrapper is skipped so we don't ship the markup overhead.
- Key is the sanitised key, same space used in the Compare view and `translationMeta`.
- Admin-mode detection: session role ≥ editor (already available via `useSession`).

### Floating editor

- Injected once at the AdminApp level: a floating, absolute-positioned popover that attaches to whichever `[data-i18n-key]` was clicked (hold `Alt` + click, to avoid hijacking real links/buttons).
- Input shows current translation for the current site locale, plus the source-language string dimmed beneath it.
- Save-on-blur / Enter posts via `saveLanguage` for the active site locale; refreshBus emits `settings` so the page re-renders with the new value.
- Escape closes without save.

### Guardrails

- Do not tag strings inside admin chrome (they'd use `adminI18n` after the decouple — scope the tagger to public-site `t`).
- Long strings (> 200 chars) open a larger textarea instead of the inline input.
- Feature-flag behind `siteFlags.inlineTranslationEdit = true` so editors can temporarily disable when the Alt-click bindings interfere with their testing.

## Files to touch

- `src/utils/translateOrKeep.ts` (or wherever the helper lives) — conditional wrap
- `src/frontend/components/common/InlineTranslationEditor.tsx` (new)
- `src/frontend/components/AdminApp.tsx` — mount the floating editor + global click handler
- `src/Interfaces/ISiteFlags.ts` (or nearest) — new flag
- `SiteFlagsService` — persist flag
- `src/frontend/scss/admin-inline-translate.scss` — subtle hover ring around `[data-i18n-key]`

## Acceptance

- Alt-click any public-site headline while logged in → popover with current translation + source
- Save → page re-renders with new text, no reload
- Viewer-role user or logged-out: no `data-i18n-key` attributes rendered, no editor
- Escape + click-outside both close without saving
- Nested translations (string inside a translated string) don't nest popovers — always bind to the innermost key

## Risks / notes

- Wrapping every string affects SSR output diffing. Make the wrapping conditional on server-detected admin session too, not purely client.
- If `Alt`+click is already used elsewhere on the site, switch to a dedicated keyboard modifier + banner explaining the binding when flag is on.
- Performance: don't run `querySelectorAll` on every click — use event delegation on `document`.

## Effort

**L · 1–2 engineering days**

- DOM tagging helper + SSR-safe opt-in: 3–4 h
- Floating editor UI + save flow + refreshBus integration: 4–6 h
- Keyboard handling (`Alt`-click, `Esc`, `Enter`, outside-click): 1–2 h
- Flag + admin toggle + docs: 1 h
- End-to-end testing on 3+ page types: 1–2 h
