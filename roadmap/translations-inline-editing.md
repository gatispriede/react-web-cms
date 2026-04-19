# Translations — inline on-page editing · v1 **Shipped**

**Infrastructure landed (2026-04-19):**

- `<InlineTranslatable>` ([`components/common/InlineTranslatable.tsx`](../src/frontend/components/common/InlineTranslatable.tsx)) wraps any translated string in `<span data-i18n-key="…" data-i18n-source="…">`. Empty strings fall through as fragments so the markup overhead is zero when there's nothing to tag.
- `<InlineTranslationHost>` ([`components/common/InlineTranslationHost.tsx`](../src/frontend/components/common/InlineTranslationHost.tsx)) mounted once at `_app.tsx` inside a `<SessionProvider>`. It reads `siteFlags` + session role; when an editor-or-admin is logged in AND `siteFlags.inlineTranslationEdit === true`, it sets `body[data-admin-inline-edit="true"]` and spawns the editor.
- `<InlineTranslationEditor>` ([`components/common/InlineTranslationEditor.tsx`](../src/frontend/components/common/InlineTranslationEditor.tsx)) is a document-level Alt-click listener. Alt-click any `[data-i18n-key]` → floating popover shows the current value over the sanitised key + source; Enter / Save commits via `LanguageApi.saveLanguage({[key]: value})`; Escape / Cancel closes. Long strings (>200 chars) swap the input for a 4-row textarea (Ctrl+Enter to save). After save it calls `i18n.reloadResources` + `changeLanguage` so the page re-renders without a reload.
- `siteFlags.inlineTranslationEdit` added to [`ISiteFlags`](../src/Server/SiteFlagsService.ts) + [`DEFAULT_SITE_FLAGS`](../src/Server/SiteFlagsService.ts). Toggle in admin → Layout tab.
- Hover affordance (yellow highlight + dashed outline) in [`scss/Admin/InlineTranslate.scss`](../src/frontend/scss/Admin/InlineTranslate.scss), gated by the body attribute. Bottom-right "Inline translate: Alt-click" hint visible only when the feature is on.

**Proof-of-pattern migration:** [`PlainText.tsx`](../src/frontend/components/SectionComponents/PlainText.tsx) swapped its `translateOrKeep(tApp, value)` for `<InlineTranslatable tApp={tApp} source={value}/>`.

**Remaining migration work** (per-section, ~5–10 min each — rolls up to ~1–2 h):

- **JSX-children-only sections** (mechanical): [`BlogFeed`](../src/frontend/components/SectionComponents/BlogFeed.tsx), [`List`](../src/frontend/components/SectionComponents/List.tsx), [`Services`](../src/frontend/components/SectionComponents/Services.tsx), [`SkillPills`](../src/frontend/components/SectionComponents/SkillPills.tsx), [`SocialLinks`](../src/frontend/components/SectionComponents/SocialLinks.tsx), [`StatsCard`](../src/frontend/components/SectionComponents/StatsCard.tsx), [`Testimonials`](../src/frontend/components/SectionComponents/Testimonials.tsx), [`Timeline`](../src/frontend/components/SectionComponents/Timeline.tsx). Each declares `const tr = (v: string) => translateOrKeep(tApp, v);` and consumes it only as JSX children — swap to `const tr = (v: string) => <InlineTranslatable tApp={tApp} source={v}/>;`.
- **Sections with string-ops on the translated value**: [`Hero`](../src/frontend/components/SectionComponents/Hero.tsx) calls `renderAccentRuns(text, tr)` which `.split()`s the translated string to apply inline accent tokens — leave the string helper in place and add targeted wrapping per run, OR add an `as="em"`-style opt-in so the accent parts each carry their own `data-i18n-key`. Deferred as a v2 for markup-bearing strings.
- **Attribute consumers**: one callsite, [`ProjectCard.tsx:61`](../src/frontend/components/SectionComponents/ProjectCard.tsx) passes `title={tr(c.title)}` to an HTML attribute. Keep the existing `translateOrKeep` string helper for that use; only JSX children get the wrapper.

Once the above sections are migrated the Alt-click editor covers the whole public surface. The infra itself is done.

---


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
