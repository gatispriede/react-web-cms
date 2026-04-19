# Roadmap — redis-node-js-cloud CMS

Forward-looking only. For the current architecture see [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) and the UML at [public/data-model.svg](src/frontend/public/data-model.svg). Completed work lives in git history.

---

## Queued

### Decouple admin UI language from client site language (held)
The admin chrome (login, AdminApp, settings tabs, dialogs) currently shares the `i18n` instance with the public site. Editing languages or switching the public dropdown shifts the admin UI too — wrong when the admin is authoring translations for a target locale.

**Plan**: separate `i18next` instance (or dedicated namespace) pinned to a supported admin locale. Initial supported set: `en`, `lv`. User picks via a small UserStatusBar menu; preference stored on the user doc (`preferredAdminLocale`) and `localStorage.admin.locale`.

*Flagged as "do not start yet" by the owner — waiting on go-ahead.*

### Translations — remaining phase 3
- Per-key `context` / `description` field so translators know what they're translating. Needs a small JSON map on `SiteSettings` plus an inline textarea in the Compare view.
- Inline on-page editing — click a translatable string → popover with input. Needs a DOM-tagging convention (data-i18n-key) added to every string rendered via `translateOrKeep`, plus a floating editor that posts back through `saveLanguage`.

### First-boot admin password — generate + surface (prod)
Today the seed admin password comes from `ADMIN_DEFAULT_PASSWORD` (plain env var). For real deployments, generate a strong unique password on first `setupAdmin` when neither `ADMIN_DEFAULT_PASSWORD` nor `ADMIN_PASSWORD_HASH` is set, then:
- Write it once to a protected artefact — either a single-line file at `var/admin-initial-password.txt` with `0600` perms (preferred for headless boxes) or print a highly-visible "INITIAL ADMIN PASSWORD = …" banner to stdout when running interactively.
- Stamp the user doc with `mustChangePassword: true` so the admin UI nags until it's rotated; surface a persistent banner in `UserStatusBar` while the flag is set.
- Never log the plain password to the standard app log file.
- Never regenerate — if the file exists but the user was deleted, fail loud rather than silently re-seeding a different password.

Document the flow in `DEPLOY.md` next to the MongoDB section.

### Theme picker — visual previews
Admin → Theme currently lists presets with a tiny color-swatch row. Users want a better sense of how a theme actually looks before activating. Build a per-card preview:
- Fake "page in miniature" (hero headline + meta row + button) rendered with the card's tokens applied via scoped CSS vars + `data-theme-name` on a container instead of body.
- ~240×180 frame, cropped content, covers the dominant surfaces (bg, ink, accent, rule, display + mono fonts).
- Works for both color-only presets (Classic/Ocean/Forest/Midnight) and editorial themes with module-level overrides (Paper/Studio) — the preview container must apply the same SCSS theme scope.

### Admin UX — phase 2 remaining
- **DnD phase 2 — library swap** — the visible drop-placeholder + "gap at drop target" landed via a native-HTML5 rewrite of [`DraggableWrapper`](src/frontend/components/common/DraggableWrapper.tsx); `react-drag-reorder` is now unused. Still queued: swap to `@dnd-kit/sortable` for viewport-edge auto-scroll + touch support, extend DnD to items within a section, drag images from a side panel.
- **High-contrast** theme option beyond dark mode.
- **Icon consolidation** — pick one set (`lucide-react` or Phosphor), retire the mix of `@ant-design/icons` + `styled-icons`.

### Audit log — UI surfacing next
Service-layer stamps + Navigation/Section GraphQL exposure + inline `<AuditBadge>` on page tabs, section cards, and every settings tab (Theme, Logo, Post, Footer, SiteFlags/Layout, SiteSeo, Language) now landed. Still queued:
- Optional chronological `AuditLog` collection + a Site-settings → Audit tab if per-doc inline stamps prove insufficient.

### Tests — remaining
- Frontend: `LoginBtn` + session render, section component snapshots + empty-content edge cases, `MongoApi` facade delegation via mocked `*Api` modules. Infra is now in place (`@vitejs/plugin-react` installed, jsdom env wired via `// @vitest-environment jsdom` directive; see [useAutosave.test.tsx](src/frontend/lib/useAutosave.test.tsx) as the pattern).
- API route integration via supertest or direct Next handler invocation: `/api/setup` idempotent, `/api/export` + `/api/import` round-trip preserves DB + requires admin.

---

## Debt

- **GQty client edits** — `schema.generated.ts` still has manual patches (`getLogo` nullability, `createDatabase` removal, `getSiteSeo`/`saveSiteSeo`, `INewLanguage.flag`, `ILogo.id/type` nullability, `INavigation`/`ISection` audit fields, and the `ISection` composition fields `slots` / `overlay` / `overlayAnchor` mirrored on `InSection`). Regenerate cleanly with `npm run generate-schema` once a stable endpoint is up.
- **sanitizeKey regex v2** — the old `sanitizeKey` char class closes early on `]`, so most specials survive. [`sanitizeKeyV2`](src/utils/stringFunctions.ts) lives alongside with the correct class but isn't wired yet. Migration plan: new keys go through v2, existing translations stay on v1 until a one-shot rekey script copies them over. Tests in [helpers.test.ts](src/utils/helpers.test.ts) lock both behaviours.
- **Ghost Navigation docs** — one-shot cleanup script at [Scripts/cleanup-ghost-navigation.ts](Scripts/cleanup-ghost-navigation.ts). Runs dry by default; pass `--apply` to delete.
- **`react-drag-reorder` dependency is now unused** — the native-HTML5 DnD rewrite replaced it. Can be dropped from `package.json` + `package-lock.json` next time touching deps.
