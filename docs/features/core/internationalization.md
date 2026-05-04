# Internationalization

## Overview

The CMS supports multilingual public sites and a separately-localised admin UI. Translations are stored in MongoDB, mirrored to disk JSON files, and served via `i18next`.

## Site translations

- Each language is a `Languages` doc: `{label, symbol, default?, flag?, translations: JSON}`.
- The `translations` JSON is a flat key → string map (e.g. `"hero.title": "Hello"`).
- The default language is the public fallback; visitors switch via a language selector in the site nav.
- Admin → Languages shows a Compare view: two columns side-by-side for source and target languages.

## Translation meta / context

Each translation key can carry a `{description?, context?}` annotation stored in `SiteSettings` (`key: 'translationMeta'`). In the Compare view a `MetaCell` popover surfaces this context to translators. Entries auto-prune when both fields are cleared.

## Accepting existing translations

The admin can mark a translation key as "accepted" (reviewed and confirmed) without re-entering the text. Checkboxes in the Languages table handle bulk acceptance.

## Admin UI language (decoupled)

The admin chrome uses its own `i18next` instance (`adminI18n`) independent from the public site bundle.

- **Locale bundles:** `src/frontend/admin-locales/{en,lv}.json`
- **Resolution order:** `user.preferredAdminLocale` → `localStorage.admin.locale` → browser language → `en`
- A three-letter chip in `UserStatusBar` lets each admin switch locale without affecting the live site.
- Adding a new admin locale requires a new JSON file and registering the locale code in the selector component.

## Inline translation editing

Any translated string wrapped in `<InlineTranslatable>` can be edited directly on the live admin preview without opening the Languages table.

- **How to trigger:** Alt+click any highlighted text in the admin preview.
- A floating popover (`<InlineTranslationEditor>`) shows the current value and key. Enter/Save commits; Escape cancels.
- The page re-renders without a full reload (`i18n.reloadResources` + `changeLanguage`).
- Feature flag: `siteFlags.inlineTranslationEdit` — toggled in admin → Layout tab.
- Long strings (> 200 chars) expand to a 4-row textarea; Ctrl+Enter to save.

See [`../architecture/admin-systems.md`](../architecture/admin-systems.md) for implementation details.
