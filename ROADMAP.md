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

### Admin UX — phase 2 remaining
- **Sidebar + content layout** replacing the single Tabs strip. Touches AdminApp render + routing.
- **Inline section editing** — drawer with live preview instead of a full modal. Touches `EditWrapper` + `AddNewSectionItem` flow.
- **DnD phase 2** — swap `react-drag-reorder` for `@dnd-kit/sortable` for drag placeholder ghost + viewport-edge auto-scroll; extend DnD to items within a section + drag images from a side panel.
- **Undo / history** — rolling stack of last 20 mutations + `Cmd-Z`. `useAutosave` hook already provides the save pipe; undo needs to wrap content mutations with reversible tickets.
- **Templates** — "Start from template" section options (Hero, Gallery, Article, Contact) in the empty state.
- **High-contrast** theme option beyond dark mode.
- **Icon consolidation** — pick one set (`lucide-react` or Phosphor), retire the mix of `@ant-design/icons` + `styled-icons`.
- **Scroll-mode polish** — active-nav highlight via IntersectionObserver scrollspy, `prefers-reduced-motion` honouring, 301 redirects from legacy `/[slug]` routes to `/#<slug>`, sitemap anchor entries.

### Audit log — UI surfacing next
Service-layer stamps + Navigation/Section GraphQL exposure + inline `<AuditBadge>` on page tabs and section cards already landed. Still queued:
- Show "last edited by X" on settings tabs (Theme, Post, Footer, SiteFlags, SiteSeo, Logo, Language) that don't yet render the stamp.
- Optional chronological `AuditLog` collection + a Site-settings → Audit tab if per-doc inline stamps prove insufficient.

### Tests — remaining
- Frontend: `LoginBtn` + session render, section component snapshots + empty-content edge cases, `MongoApi` facade delegation via mocked `*Api` modules. Infra is now in place (`@vitejs/plugin-react` installed, jsdom env wired via `// @vitest-environment jsdom` directive; see [useAutosave.test.tsx](src/frontend/lib/useAutosave.test.tsx) as the pattern).
- API route integration via supertest or direct Next handler invocation: `/api/setup` idempotent, `/api/export` + `/api/import` round-trip preserves DB + requires admin.

---

## Debt

- **GQty client edits** — `schema.generated.ts` still has manual patches (`getLogo` nullability, `createDatabase` removal, `getSiteSeo`/`saveSiteSeo`, `INewLanguage.flag`, `ILogo.id/type` nullability, `INavigation`/`ISection` audit fields). Regenerate cleanly with `npm run generate-schema` once a stable endpoint is up.
- **sanitizeKey regex v2** — the old `sanitizeKey` char class closes early on `]`, so most specials survive. [`sanitizeKeyV2`](src/utils/stringFunctions.ts) lives alongside with the correct class but isn't wired yet. Migration plan: new keys go through v2, existing translations stay on v1 until a one-shot rekey script copies them over. Tests in [helpers.test.ts](src/utils/helpers.test.ts) lock both behaviours.
- **Ghost Navigation docs** — one-shot cleanup script at [Scripts/cleanup-ghost-navigation.ts](Scripts/cleanup-ghost-navigation.ts). Runs dry by default; pass `--apply` to delete.
