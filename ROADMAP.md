# Roadmap — redis-node-js-cloud CMS

Living document of what exists, what's in flight, and what's queued. For the static architectural picture see [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md).

---

## Recently landed

### Service-layer refactor (server)
- `MongoDBConnection` reduced to an orchestrator (settings → `MongoClient` → services).
- Domain services: `UserService`, `NavigationService`, `AssetService`, `LanguageService`, `BundleService`. Each implements a contract declared in [mongoConfig.ts](src/Server/mongoConfig.ts).
- Module-level singleton via `getMongoConnection()` — Apollo route, standalone Express server, and `/api/setup` all share one Mongo client.

### API-layer split (frontend)
- [MongoApi](src/frontend/api/MongoApi.ts) is now a thin facade over:
  - `UserApi`, `AssetApi`, `LanguageApi`, `NavigationApi`, `SectionApi`.
- New code should import the specific `*Api` class rather than the facade.

### Auth + first-run flow
- `GoogleProvider` in [[...nextauth].ts](src/frontend/pages/api/auth/[...nextauth].ts) only registers when both `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set.
- `/admin` has `getServerSideProps` priming the session + translation namespaces so `useSession()` never has a cold window.
- `UserService.setupAdmin()` auto-runs on first successful Mongo connect (guarded by a static flag); also exposed as `GET/POST /api/setup`.

### Schema corrections
- `getLogo: ILogo!` → `getLogo: ILogo` (nullable, both server schema and generated GQty client); `MongoApi.getLogo` + `Logo.loadLogo` handle null.
- Unused `createDatabase` removed from schema and GQty client.
- `NavigationService.addUpdateSectionItem` generates a guid on create, appends to the nav's `sections[]` when `pageName` supplied, returns `{createSection:{id}}` JSON for `MongoApi.addSectionToPage` to parse.

### Bundle export/import — **NEW**
- Single-file JSON bundle, versioned (`manifest.version = 1`).
- `GET /api/export` — session-guarded; scans all content for local `api/<file>` image paths and inlines them as base64 in `bundle.assets`. Third-party URLs stay as URLs.
- `POST /api/import` — wipes + restores `Navigation`, `Sections`, `Languages`, `Images`, `Logos`; writes assets to `src/frontend/public/images/`.
- [BundleService](src/Server/BundleService.ts) — single class owning the round-trip logic.
- Admin UI: [Bundle.tsx](src/frontend/components/Admin/AdminSettings/Bundle.tsx) (Settings → Bundle tab) with Export button + file picker + guarded Import (`Popconfirm`).

### Compose / dev
- `mongodb` service now publishes port `27017:27017` so the host dev server reaches Mongo without the Docker `front` container.
- [.claude/launch.json](.claude/launch.json) captures all dev-server configurations.
- `/api/setup` admin seeding endpoint available for quick restores.

### Item-type registry ("siblings")
- [itemTypes/registry.ts](src/frontend/components/itemTypes/registry.ts) pairs each item type's `{Display, Editor, styleEnum, defaultContent}` in one entry.
- [ContentType.tsx](src/frontend/components/common/ContentType.tsx) (site render) and [ContentSection.tsx](src/frontend/components/common/ContentSection.tsx) (admin editor) collapsed from 5-case switches into 3-line lookups.
- Adding a new block kind is now a single file edit.

### Content safeguards (first pass)
- [SectionErrorBoundary](src/frontend/components/common/SectionErrorBoundary.tsx) wraps every section — one broken payload no longer kills the page; admin view shows a small diagnostic, public view silently drops the offending section.
- [sanitizeHtml](src/utils/sanitize.ts) — conservative regex scrubber for `<script>`/event handlers/`javascript:` URLs, applied to `RichText` before `innerHTML`. Upgrade path: DOMPurify.
- [BundleService.import](src/Server/BundleService.ts) hardened — filename allowlist, 25 MB/asset cap, strict data-URI match, `path.resolve()` containment check, shape guard on site collections, `skippedAssets[]` reported to the admin.
- Non-string `html` guard in [translationsutils.ts](src/utils/translationsutils.ts) (prevented a runtime `html.trim is not a function` seen earlier).

### User management CRUD (roadmap #1)
- GraphQL schema extended: `InUser` input, `mongo.getUsers`, `mongo.addUser`, `mongo.updateUser`, `mongo.removeUser`. Generated GQty client patched.
- [UserService](src/Server/UserService.ts) — full CRUD with bcrypt hashing on password set/update, email normalization, duplicate-email guard, last-admin removal guard, auto-migration of pre-existing admin to `role: 'admin'` on boot.
- [UserApi](src/frontend/api/UserApi.ts) — `listUsers`/`addUser`/`updateUser`/`removeUser` methods.
- [Users.tsx](src/frontend/components/Admin/AdminSettings/Users.tsx) — AntD table with Add/Edit modals, role selector (`viewer`/`editor`/`admin`), role tags (coloured), per-row Edit + confirm-delete, blocks self-deletion, refresh button.
- Verified end-to-end: add → update → remove via GraphQL, table rendering via admin UI.
- [admin/settings.tsx](src/frontend/pages/admin/settings.tsx) now has `getServerSideProps` priming session + `common`/`app` i18n namespaces.

### Roles carried through session + API gating (roadmap #2, phase 1)
- NextAuth JWT + session callbacks now carry `user.role`; `/api/auth/session` returns `{role: "admin" | "editor" | "viewer"}`.
- [\_authHelpers.ts](src/frontend/pages/api/_authHelpers.ts) — `requireRole(req, res, minimum)` returns 401/403 + surfaces `currentRole` on denial; role rank `viewer(0) < editor(1) < admin(2)`.
- `/api/import` now requires `admin`; `/api/export` requires `editor` (admin ∈ editor).
- Admin Settings tabs (`AdminSettings.tsx`) gate `Users` and `Bundle` behind `role === 'admin'` via `useSession()`.
- Verified: unauthenticated POST → 401; authenticated admin import → 200 + roundtrip restored (3 navs / 13 sections / 4 images / 1 asset).

### GraphQL resolver guards + draft/publish split (roadmap #2, phase 2) — **NEW**
- [authz.ts](src/Server/authz.ts) — `sessionFromReq`, `guardMethods(target, session, requirements, capabilities)` returning a method-level Proxy that throws `AuthzError` for insufficient role or failed capability check.
- [graphql.ts](src/frontend/pages/api/graphql.ts) — Apollo context now carries session; `Query.mongo` / `Mutation.mongo` wrap `getMongoConnection()` in `guardMethods(...)`. `MUTATION_REQUIREMENTS` and `QUERY_REQUIREMENTS` table drives per-method gating (editor for content/bundle/language mutations; admin for `addUser`/`updateUser`/`removeUser`/`getUsers`/`loadData`/`getMongoDBUri`/`setupAdmin`).
- NextAuth JWT + session now carry `canPublishProduction` alongside `role`.
- `canPublishProduction` persisted on user docs — [UserService](src/Server/UserService.ts) writes + reads the flag; [Users.tsx](src/frontend/components/Admin/AdminSettings/Users.tsx) adds a "Can publish" column + a `Switch` in the edit dialog.
- [PublishService](src/Server/PublishService.ts) — new `PublishedSnapshots` collection. `publishSnapshot(publishedBy)` copies current Navigation/Sections/Languages/Logos/Images into a versioned doc; `getActiveSnapshot()` / `getActiveMeta()` read the latest.
- GraphQL: `publishSnapshot: String!` mutation (requires `editor` role **and** `canPublishProduction` capability), `getPublishedSnapshot: String` / `getPublishedMeta: String` queries.
- Admin UI — "Publish" button + last-published tag in [AdminApp.tsx](src/frontend/components/Admin/AdminApp.tsx), visible only when `session.user.canPublishProduction && role >= editor`.
- Public render — [app.tsx](src/frontend/pages/app.tsx) now tries `PublishApi.getSnapshot()` first; falls back to draft if no snapshot exists. Sections per page are resolved from the snapshot's `navigation[].sections[]` ids.
- UI role gating — `AdminApp` computes `role` from session, sets `admin = role !== 'viewer'`, `canEditNav = editor+`. Tabs switch between `editable-card` / `card`; `onEdit` is a no-op for viewers; `DynamicTabsContent` / `SectionContent` / `EditWrapper` inherit `admin` and hide "+"/delete/drag for viewers automatically.

### Theme switcher + runtime theming (roadmap #3 + #4) — **NEW**
- Data model — [ITheme.ts](src/Interfaces/ITheme.ts). Two new collections: `Themes` (`{id, name, tokens, custom}`) and `SiteSettings` (key/value; holds `activeThemeId`).
- [ThemeService](src/Server/ThemeService.ts) — seeds four presets (Classic / Ocean / Forest / Midnight) on first connect, CRUD with last-admin-style guards (presets can be duplicated but not modified or deleted; deleting the active theme falls back to the next one).
- GraphQL — `getThemes`, `getActiveTheme`, `saveTheme(theme: JSON!)`, `deleteTheme(id)`, `setActiveTheme(id)`. Mutations gated at `editor` via `MUTATION_REQUIREMENTS`.
- [ThemeApi](src/frontend/api/ThemeApi.ts) — list/getActive/save/delete/setActive.
- [Theme.tsx](src/frontend/components/Admin/AdminSettings/Theme.tsx) — card gallery with swatches + Activate / Duplicate / Edit / Delete. Editor modal uses `ColorPicker` for 7 color tokens + `InputNumber` for `borderRadius` and `fontSize`, with a live preview via `ConfigProvider` over sample `Button`/`Tag`s.
- [buildThemeConfig.ts](src/frontend/theme/buildThemeConfig.ts) — converts persisted tokens to AntD `ThemeConfig`.
- Runtime integration — both [AdminApp.tsx](src/frontend/components/Admin/AdminApp.tsx) and [app.tsx](src/frontend/pages/app.tsx) fetch the active theme and feed it into their `<ConfigProvider theme={...}>`. Falls back to `themeConfig.ts` static token set.
- CSS variables — [applyThemeCssVars.ts](src/frontend/theme/applyThemeCssVars.ts) mirrors the active tokens into `--theme-*` custom properties on `documentElement` (and legacy `--primary`/`--background` for back-compat). Scoped in `global.scss` so module styling (PlainText/RichText/PlainImage/Gallery/Carousel) picks up text color, background, and border radius from the theme, while admin chrome stays on the static `themeConfig.ts` — documented in [THEMING.md](THEMING.md).

### Translations UX — table + filter (roadmap #6, phase 1) — **NEW**
- [ContentLoader.tsx](src/frontend/components/Admin/AdminSettings/ContentLoader.tsx) replaced the stack of inputs with an AntD `Table`: Key / Source / Translation columns, per-key `Input` with warning status on missing keys, search box over key + source, "Missing only" toggle, paginated 25/50/100. Default-language tab shows read-only Key+Source.

### Menu + admin UX niceties (#5 / #7 touches) — **NEW**
- UserStatusBar now surfaces both "App building" (`/admin`) and "Site settings" (`/admin/settings`) simultaneously; the current page's button uses `primary` styling. Preview opens `/${lang}/?preview=1` in a new tab (noopener).
- AdminApp has a dark-mode toggle (`Switch` with bulb icons) that persists to `localStorage.admin.darkMode` and swaps AntD algorithm between default and dark.
- `DynamicTabsContent` renders a proper `Empty` placeholder when a page has no sections (different copy for admin vs. viewer).

### Vitest baseline (roadmap #9, phase 1) — **NEW**
- Added `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` + `mongodb-memory-server` + `@vitest/coverage-v8` as devDeps.
- Root [vitest.config.ts](vitest.config.ts) with dual-environment (`node` default, `jsdom` for `src/frontend/**`), coverage config excluding generated GQty + public assets.
- npm scripts: `test`, `test:watch`, `test:coverage`.
- 27 passing tests across 5 files:
  - [contentSchemas.test.ts](src/utils/contentSchemas.test.ts) — 10 cases for the new per-item-type validators.
  - [sanitize.test.ts](src/utils/sanitize.test.ts) — 5 cases covering non-strings, `<script>`, inline handlers, `javascript:` URLs.
  - [authz.test.ts](src/Server/authz.test.ts) — 4 cases for `guardMethods` role + capability gates.
  - [buildThemeConfig.test.ts](src/frontend/theme/buildThemeConfig.test.ts) — 3 cases for token normalization.
  - [UserService.test.ts](src/Server/UserService.test.ts) — 5 integration cases against an in-memory Mongo (`mongodb-memory-server`): setupAdmin idempotency, addUser bcrypt hashing + duplicate guard, updateUser canPublishProduction toggle, removeUser last-admin guard, getUsers password masking.

### Content safeguards phase 2 (roadmap #8, phase 2) — **NEW**
- [contentSchemas.ts](src/utils/contentSchemas.ts) — per-item-type validators (Text / RichText / Image / Gallery / Carousel + unknown-type passthrough) with size caps (RichText 200KB, items arrays 200 entries) and image src allowlist (`api/` local or `https?://`).
- Applied at two write boundaries:
  - [NavigationService.addUpdateSectionItem](src/Server/NavigationService.ts) — rejects mutations whose `section.content[*]` shape fails validation, returns `{error: ...}` so the admin UI surfaces the message.
  - [BundleService.import](src/Server/BundleService.ts) — atomic validation pass over every `sections[i]` before wiping the DB; a single malformed section aborts the import.
- DOMPurify + Zod are queued (no dependency changes made this pass — installing them was out of scope).
- Bundle round-trip — [BundleService](src/Server/BundleService.ts) now exports `themes[]` + `activeThemeId` and restores them into `Themes` + `SiteSettings` on import.

---

## In flight / queued

### 1. ~~User management in admin settings~~ — **done** (see Recently landed).

### 2. Permissions & roles — ~~phase 1~~ + ~~phase 2~~ **done**. Follow-ups for a later pass:
  - Standalone Express server (`src/Server/index.ts`) still has no session context; currently only the `/api/graphql` Next route is guarded.
  - Snapshot history UI (list all published snapshots, roll back).
  - Per-mutation audit log with `publishedBy` / `editedBy`.

### 3. ~~Theme switcher with custom colors~~ — **done** (see Recently landed).

### 4. ~~Theme integration (runtime)~~ — **done** (AdminApp + public app.tsx wrap `ConfigProvider` with the active theme; bundle includes themes + activeThemeId). Follow-ups:
  - Move theme fetch to `_app.tsx getInitialProps` so the very first paint uses the active theme (currently the client picks it up after initialize).
  - Emit CSS variables alongside AntD tokens so non-AntD SCSS files can reuse them.
  - Cache the active theme in shared GQty client to avoid one roundtrip per navigation.

### 5. Menu rearrangement — "Administration" → "App building" — **done (first pass)**
- [UserStatusBar.tsx](src/frontend/components/Admin/UserStatusBar.tsx) now surfaces both destinations at once: "App building" (`/admin`) and "Site settings" (`/admin/settings`). The button matching the current page is styled as `primary`.
- [AdminSettings.tsx](src/frontend/components/Admin/AdminSettings.tsx) reordered tabs Site-first: Users → Theme → Bundle → Languages; default tab is Users for admins, Theme for editors.
- Follow-ups: migrate Languages out of Site settings into App building (currently no second AdminApp tab to host it); add domain/SEO defaults tab under Site settings.

### 6. Translations UX polish — phase 1 done (table + search + missing-only). **Phase 2 queued:**
  - Side-by-side column layout: Key | lv | en | ru | … — requires loading all languages into the page at once.
  - Bulk paste from CSV / JSON.
  - Per-key `context` / `description` field so translators know what they're translating.
  - Inline editing on the public/admin pages (click a translatable string → popover with input).

### 7. Admin-side interaction & layout (2026 standards) — partial
- **Landed**: dark-mode toggle on AdminApp (persisted in localStorage); `Empty` state when a page has no sections; both top-level admin destinations visible in UserStatusBar.
- **Queued**:
  - **Sidebar + content layout** instead of single Tabs strip.
  - **Inline section editing** — clicking a section cell opens a side drawer with live preview (replace current full modal).
  - **Command palette** (Cmd/Ctrl-K) — jump to any page, add a section, open settings.
  - **Drag & drop** — extend to items within a section; drag images from a side panel.
  - **Undo / history** — rolling stack of last 20 mutations + `Cmd-Z`.
  - **Autosave + dirty indicator** — debounced save after 1s idle + small "saved" pill.
  - **"Start from template"** section options (Hero, Gallery, Article, Contact) in the empty state.
  - **Accessibility** — focus trapping + Escape on dialogs, landmarks (`main`/`nav`/`aside`), skip-to-content.
  - **High-contrast option** beyond simple dark mode.
  - **Icons** — consolidate `@ant-design/icons` + `styled-icons` into one set (`lucide-react` or Phosphor).
  - **Build quality gates** — remove CRA-era polyfills (`crypto-browserify`, `node-polyfill-webpack-plugin`, `buffer`, `util`, `url`) since Next 15 doesn't need them.

---

### 8. Content safeguards — phase 2 done (per-item-type validators gate server mutation + bundle import). Follow-ups:
Today a malformed section `content` string crashes a render (`RichText.useEffect → convertFromHTMLToContentBlocks` threw `html.trim is not a function` earlier this session), and an import with unexpected shape silently writes garbage into Mongo. Goal: every content boundary validates, and a single broken item can't take the page down.

**Validation layers**
- **Per-item-type schema** — define a Zod schema for each item type (`PlainText`, `PlainImage`, `RichText`, `Gallery`, `CarouselView` + future ones). Content JSON parses against the schema on every save (admin UI + GraphQL mutation) and every read (render + export/import).
- **Server-side mutation guard** — `NavigationService.addUpdateSectionItem` parses `section.content[].content` per its `type` and rejects with a clean error rather than upserting garbage.
- **Bundle import validation** — before wiping DB, validate `manifest.version` + Zod-validate each collection document. Reject the whole bundle on any failure (atomic import, no partial state).
- **Asset filename sanitization** — `BundleService.import` already uses `path.basename`; extend to a regex allowlist (`^[\w\-.]+\.(jpg|jpeg|png|gif|webp|svg)$`) so a hostile bundle can't write `../../etc/...` or executables.
- **GraphQL input size limits** — Apollo `validationRules` with `depthLimit` + a max-document-size middleware; block multi-MB payload DoS.

**Rendering safeguards**
- **Error boundary per section** — wrap each `<SectionContent/>` in a React error boundary. On render throw: show a small "This section failed to render" admin-only banner, keep the rest of the page alive.
- **Defensive parsers** — every section component should `try/catch` its `JSON.parse(item.content)` + default to an empty shape; the `typeof html !== 'string'` guard added to `translationsutils.ts` this session is the pattern.
- **RichText sanitization** — run `dompurify` on server-provided HTML before innerHTML; block `<script>`, inline event handlers, `javascript:` URLs. Current RichText directly assigns `innerHTML` which is an XSS vector.
- **Image URL validation** — on save, only allow `^api/[^/]+\.(jpg|png|...)$` (local) or `^https?://.+` (external) in image `src` fields.

**Auth-side safeguards**
- Rate-limit `/api/auth/callback/credentials` (bcrypt compare is CPU-bound) and `/api/import` (destructive).
- Require `role: 'admin'` — not just any session — for `/api/import`, bundle export, setup, and the destructive navigation mutations.
- CSRF token on `/api/import` (NextAuth already has `next-auth.csrf-token` — reuse).

**Testing the safeguards**
- Fuzz tests on the Zod schemas (invalid shapes, wrong types, oversized payloads).
- A "hostile bundle" fixture in the test suite that attempts: wrong version, missing collections, path-traversal asset names, XSS HTML in RichText, oversized base64 blob.
- Snapshot tests for the error boundary's fallback UI.

---

### 9. Unit / integration test coverage — phase 1 landed (Vitest baseline, 27 passing tests). **Phase 2 queued:**
- **Services** — `NavigationService` (create/update/delete + `addUpdateSectionItem` guid generation & nav append), `AssetService` (saveImage/deleteImage/getImages tag filter), `LanguageService`, `BundleService` (export→import round-trip), `ThemeService` (preset seeding + activate/duplicate/delete), `PublishService` (snapshot latest-wins).
- **Frontend** — `LoginBtn` + session render, section components snapshot + empty-content edge cases, `MongoApi` facade delegation via mocked `*Api` modules.
- **API route integration** — `/api/setup` idempotent, `/api/export` + `/api/import` round-trip preserves DB + requires admin.
- **CI** — GitHub Action that runs `npm run test` + typecheck on PRs with a coverage floor.

---

## Debt / cleanups

- **Hardcoded secrets** in [mongoConfig.ts](src/Server/mongoConfig.ts) (admin password, Mongo Atlas user/pass, cluster URL). Move to env vars.
- **Duplicated editor stacks** — `draft-js` + `react-draft-wysiwyg` vs `ckeditor5`. Finish the migration (`0d1ee9e` commit indicates CK is the target) and drop the losing side.
- **Two GraphQL servers** — `express-graphql` (standalone) and `apollo-server-micro` (Next route) serve the same schema. Keep only one unless there's a reason for the split.
- **GQty client edits** — `schema.generated.ts` has manual patches (`getLogo` nullability, `createDatabase` removal). Re-run `npm run generate-schema` against a live endpoint to regenerate cleanly.
- **Pre-existing typecheck gaps**:
  - `src/Server/sslServer.ts:20` — `url.parse(undefined-able)` null-check.
  - `src/frontend/components/Admin/AdminSettings/Languages.tsx:63` — comparison `boolean | undefined` vs `string`.
  - `src/frontend/pages/api/auth/[...nextauth].ts:47` — `user.password` narrow after the API split.
- **Stale README** — still default CRA template.
- **Hydration mismatch** on `LoginBtn` ("Please sign in" vs "Lūdzu pieslēdzies") — `_app.tsx` should pre-select the locale server-side to match what `next-i18next` serves, avoiding the first-paint delta.
- **Per-item schema validation** — content JSON is free-form today; add a Zod (or similar) schema per item type so imports fail cleanly on bad shapes instead of breaking at render time.
