# Translations

The CMS is multilingual end-to-end. Every visible string is keyed; a language switcher in the public nav swaps the active locale.

## Languages pane

`/admin/site/languages` — add a language with:

- **Symbol** — ISO code (`en`, `lv`, `et`).
- **Label** — display name in the switcher.
- **Flag** — emoji or short string.
- **Default** — exactly one language is the fallback.

Languages are stored in Mongo and mirrored to `ui/client/public/locales/<sym>/app.json` so `next-i18next` can serve them at runtime.

## Translations pane

`/admin/site/translations` — keyed table. Rows are translation keys (auto-collected from the codebase + content); columns are languages. Edit cells inline; saves on blur.

Sources of keys:

- Static UI strings — `t('Sign in')` calls; the codegen scans them.
- Content — RichText / Hero / ProjectCard fields run through `extractTranslationsFromHTML`, which surfaces `<i18n>...</i18n>` markers as keys.

## Inline editing on the public site

Toggle **Inline translation edit** in Settings → Site flags. Editor-rank users see an overlay on the public site; clicking any translatable string opens an in-place editor that writes back through `cms.translate`.

## Bundle import

Importing a bundle replaces the Languages collection AND writes translations to disk in one step (see `BundleService.import`). This is the only path that mutates the on-disk `locales/<sym>/app.json` files outside of admin saves.
