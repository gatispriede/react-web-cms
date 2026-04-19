# Decouple admin UI language from client site language

**Status:** Shipped (2026-04-19).

## Goal

The admin chrome (login, AdminApp, settings tabs, dialogs) no longer share the public site's `i18n` instance. Editing a language or toggling the public locale selector leaves admin text untouched — critical when the admin is actively authoring translations for that target locale.

## Design

- Dedicated `i18next` instance for admin (`adminI18n`), separate bundle + resource files.
- Supported admin locales start as `en`, `lv`. Additions require a code change; we do not expose admin locale as another editable language doc.
- Locale selection precedence: `user.preferredAdminLocale` → `localStorage.admin.locale` → browser → `en`.
- Small selector in `UserStatusBar` (three-letter chip + dropdown); change calls `updateUser` and writes localStorage as fallback.
- Admin translation namespace lives in-repo (`src/frontend/admin-locales/{en,lv}.json`), not in Mongo. Checked into git; translators edit via PRs for now.

## Files to touch

- New: `src/frontend/lib/adminI18n.ts`, `src/frontend/admin-locales/{en,lv}.json`
- `src/frontend/components/AdminApp.tsx`, settings tabs, dialogs — wrap in `<I18nextProvider i18n={adminI18n}>` and use its `t`
- `src/frontend/components/common/UserStatusBar.tsx` — locale chip
- `src/Interfaces/IUser.ts` — add `preferredAdminLocale?: 'en' | 'lv'`
- `UserService.updateUser` — accept the new field
- `next-i18next.config.js` — confirm no cross-contamination

## Acceptance

- Switching public dropdown does not alter any admin pane's visible text
- Editing a language's translations never shifts admin chrome
- Logging in as a user with `preferredAdminLocale: 'lv'` renders admin in Latvian from first paint, no flicker
- `localStorage.admin.locale` works when unauthenticated (login page itself)

## Risks / notes

- Many existing admin components pull `useTranslation()` from the default namespace. Grep and migrate in a single pass; a mixed state is worse than the current shared instance.
- Keep admin locale JSON files flat — sanitised keys encourage re-use of the public-site key scheme and we'd lose the decoupling.

## Effort

**M–L · ~1 engineering day**

- Config + instance: 1 h
- Wrap providers + selector UI: 2–3 h
- Migrate every admin `useTranslation` call site: 2–3 h (grep-driven)
- User doc persistence + `UserStatusBar` integration: 1 h
- Test on a real translation edit flow: 1 h
