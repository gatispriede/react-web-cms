# Roadmap — redis-node-js-cloud CMS

Forward-looking only. For the current architecture see [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) and the UML at [public/data-model.svg](src/frontend/public/data-model.svg). Completed work lives in git history.

Per-item implementation plans + time estimates live under [`roadmap/`](roadmap/). Start with [`roadmap/README.md`](roadmap/README.md) for the index.

---

## Queued

### Decouple admin UI language from client site language (held)
The admin chrome (login, AdminApp, settings tabs, dialogs) currently shares the `i18n` instance with the public site. Editing languages or switching the public dropdown shifts the admin UI too — wrong when the admin is authoring translations for a target locale.

**Plan**: separate `i18next` instance (or dedicated namespace) pinned to a supported admin locale. Initial supported set: `en`, `lv`. User picks via a small UserStatusBar menu; preference stored on the user doc (`preferredAdminLocale`) and `localStorage.admin.locale`.

*Flagged as "do not start yet" by the owner — waiting on go-ahead.*

### Translations — remaining phase 3
- ~~Per-key `context` / `description` field~~ — **shipped**. `translationMeta` map on `SiteSettings` + `MetaCell` popover in the Compare view; entries auto-prune when both fields cleared.
- Inline on-page editing — click a translatable string → popover with input. Needs a DOM-tagging convention (data-i18n-key) added to every string rendered via `translateOrKeep`, plus a floating editor that posts back through `saveLanguage`.

### First-boot admin password — generate + surface (prod)
Today the seed admin password comes from `ADMIN_DEFAULT_PASSWORD` (plain env var). For real deployments, generate a strong unique password on first `setupAdmin` when neither `ADMIN_DEFAULT_PASSWORD` nor `ADMIN_PASSWORD_HASH` is set, then:
- Write it once to a protected artefact — either a single-line file at `var/admin-initial-password.txt` with `0600` perms (preferred for headless boxes) or print a highly-visible "INITIAL ADMIN PASSWORD = …" banner to stdout when running interactively.
- Stamp the user doc with `mustChangePassword: true` so the admin UI nags until it's rotated; surface a persistent banner in `UserStatusBar` while the flag is set.
- Never log the plain password to the standard app log file.
- Never regenerate — if the file exists but the user was deleted, fail loud rather than silently re-seeding a different password.

Document the flow in `DEPLOY.md` next to the MongoDB section.

### ~~Theme picker — visual previews~~ — **shipped**
Admin → Theme cards now render a 260×195 mini page via [`ThemePreviewFrame`](src/frontend/components/Admin/AdminSettings/ThemePreviewFrame.tsx) with hero headline + meta strip + body paragraph + rule + primary button. Tokens are inlined as CSS vars on a wrapper carrying `data-theme-name={slug}`; theme SCSS (Paper / Studio / Industrial) targets `[data-theme-name="…"]` without a `body` ancestor, so module-level editorial overrides render inside the preview. Scoping contract documented in [THEMING.md](THEMING.md).

### Admin UX — phase 2 remaining
- ~~**DnD phase 2 — library swap**~~ — **shipped**. [`DraggableWrapper`](src/frontend/components/common/DraggableWrapper.tsx) now wraps `@dnd-kit/core` + `@dnd-kit/sortable` with Pointer / Touch / Keyboard sensors. Touch + auto-scroll are now free; keyboard drag works (`space` + arrows). Pulsing drop-indicator preserved. **Intra-section drag pilot** also shipped: new [`SortableList`](src/frontend/components/common/SortableList.tsx) with explicit `≡` drag handles wired into [`InputList`](src/frontend/components/Admin/ConfigComponents/InputList.tsx); same recipe rolls out to other array-backed configs in ~10 min each. Image side panel still deferred — see [roadmap/dnd-phase-2.md](roadmap/dnd-phase-2.md).
- ~~**High-contrast** theme option beyond dark mode~~ — **shipped (v1)**: new `High contrast` preset (slug `high-contrast`) with WCAG AAA ink/bg, persistent yellow focus rings, underlined links, 2px rules. SCSS at [`Themes/HighContrast.scss`](src/frontend/scss/Themes/HighContrast.scss). Auto-pick via `prefers-contrast: more` deferred — see roadmap.
- ~~**Icon consolidation**~~ — **shipped**. Phase 1: dead `styled-icons` dep dropped + lint lock. Phase 2: `@ant-design/icons` → `lucide-react` across 36 source files via centralised adapter at [`common/icons.tsx`](src/frontend/components/common/icons.tsx); `@ant-design/icons` import locked at the lint level too. Adapter forces 16 px / 1.75 stroke / baseline align so the visual swap is invisible. See [roadmap/icon-consolidation.md](roadmap/icon-consolidation.md).

### Audit log — UI surfacing next
Service-layer stamps + Navigation/Section GraphQL exposure + inline `<AuditBadge>` on page tabs, section cards, and every settings tab (Theme, Logo, Post, Footer, SiteFlags/Layout, SiteSeo, Language) now landed. Still queued:
- Optional chronological `AuditLog` collection + a Site-settings → Audit tab if per-doc inline stamps prove insufficient.

### ~~Google Fonts picker~~ — **shipped (v1)**
[`FontPicker`](src/frontend/components/Admin/AdminSettings/FontPicker.tsx) browses a curated 58-family catalogue at [`google-fonts.json`](src/frontend/data/google-fonts.json), writes a full CSS font-family stack to the editing theme's `fontDisplay` / `fontSans` / `fontMono` token, and [`_document.tsx`](src/frontend/pages/_document.tsx) composes a deduped `<link>` URL from the active theme's families plus the bundled Paper / Studio / Industrial set. Deferred for later: catalogue refresh script (`Scripts/update-google-fonts.ts`) and the self-hosted `@fontsource` GDPR-clean variant — see [roadmap/google-fonts-picker.md](roadmap/google-fonts-picker.md).

### ~~Architecture docs page~~ — **shipped (v1)**
Consolidated entry point at [`docs/architecture/README.md`](docs/architecture/README.md) plus four new docs ([`overview`](docs/architecture/overview.md), [`data-model`](docs/architecture/data-model.md), [`request-lifecycle`](docs/architecture/request-lifecycle.md), [`auth-roles`](docs/architecture/auth-roles.md), [`publishing`](docs/architecture/publishing.md)) covering gaps the existing root-level canonical docs ([`PROJECT_ANALYSIS.md`](PROJECT_ANALYSIS.md), [`THEMING.md`](THEMING.md), [`DEPLOY.md`](DEPLOY.md)) didn't. Index links to both, and root files stay put so the dozens of cross-links from `roadmap/`, SCSS file headers, and ROADMAP itself don't rot. Deferred for later: in-app `/admin/help` route + Mermaid pipeline (`mermaid` + `remark-react` + `rehype-sanitize` deps), Mermaid sequence + container diagrams, CI reminder script. See [roadmap/architecture-docs-page.md](roadmap/architecture-docs-page.md).

### Automatic deployment + first-time server setup
Single `scripts/bootstrap.sh` takes a cold Ubuntu droplet to a running CMS in under 5 min; GitHub Actions pipeline deploys on push to `main` with rollback via tagged images. New `/api/health` for readiness; new `/admin/welcome` wizard for the first-admin-login experience. Depends on [first-boot-admin-password.md](roadmap/first-boot-admin-password.md). See [roadmap/automatic-deployment.md](roadmap/automatic-deployment.md).

### Digital Ocean — domain + TLS wiring
Wire the production domain to the droplet via DO DNS, serve over HTTPS through a Caddy container with auto-renewing Let's Encrypt certs, `www` → apex redirect, HSTS, and DO Cloud Firewall locked down. Depends on the deployment pipeline. See [roadmap/digitalocean-domain-wiring.md](roadmap/digitalocean-domain-wiring.md).

### Multi-admin conflict mitigation — Layer 1 **shipped** + rolled out to Theme/Post/Footer
Optimistic concurrency via `version` field + conflict response shape live across every editable doc type. Server-side: [`conflict.ts`](src/Server/conflict.ts) primitives (`ConflictError`, `requireVersion`, `nextVersion`) + `runMutation` helper in [`mongoDBConnection.ts`](src/Server/mongoDBConnection.ts) serialise conflicts to `{conflict, currentVersion, currentDoc, message}`. All write services (Section, Theme, Post, Footer, SiteFlags, SiteSeo, TranslationMeta) now bump `version` on save and reject mismatches when the caller supplies `expectedVersion`. GraphQL mutations carry an `expectedVersion: Int` arg; GQty patched accordingly. Frontend: [`lib/conflict.ts`](src/frontend/lib/conflict.ts) typed `ConflictError` + `parseMutationResponse`, reusable [`ConflictDialog`](src/frontend/components/common/ConflictDialog.tsx), wired end-to-end into the Section, Theme, Post, and Footer editors. SiteFlags / SiteSeo / TranslationMeta / Logo / Language UIs still need wiring (~30 min per editor). Layer 2 (presence) and Layer 3 (soft lock) deferred — see [roadmap/multi-admin-conflict-mitigation.md](roadmap/multi-admin-conflict-mitigation.md).

### Tests — remaining (partial **shipped**)
- ✅ `MongoApi` facade delegation via mocked `*Api` modules — [MongoApi.test.ts](src/frontend/api/MongoApi.test.ts) (6 tests).
- ✅ Conflict primitives — [lib/conflict.test.ts](src/frontend/lib/conflict.test.ts) (9 tests) lock the `parseMutationResponse` / `ConflictError` contract that conflict-aware editors depend on.
- ✅ Google Fonts helpers — [theme/googleFonts.test.ts](src/frontend/theme/googleFonts.test.ts) (10 tests) cover catalogue + URL composition.
- Still queued: `LoginBtn` + session render, per-section-type snapshots, API route integration (`/api/setup` idempotency, `/api/export`+`/api/import` round-trip, `/api/rescan-images` no-op behaviour). See [roadmap/tests-remaining.md](roadmap/tests-remaining.md).

---

## Debt

- **GQty client edits** — `schema.generated.ts` still has manual patches (`getLogo` nullability, `createDatabase` removal, `getSiteSeo`/`saveSiteSeo`, `INewLanguage.flag`, `ILogo.id/type` nullability, `INavigation`/`ISection` audit fields, and the `ISection` composition fields `slots` / `overlay` / `overlayAnchor` mirrored on `InSection`). Regenerate cleanly with `npm run generate-schema` once a stable endpoint is up.
- **sanitizeKey regex v2** — the old `sanitizeKey` char class closes early on `]`, so most specials survive. [`sanitizeKeyV2`](src/utils/stringFunctions.ts) lives alongside with the correct class but isn't wired yet. Migration plan: new keys go through v2, existing translations stay on v1 until a one-shot rekey script copies them over. Tests in [helpers.test.ts](src/utils/helpers.test.ts) lock both behaviours.
- **Ghost Navigation docs** — one-shot cleanup script at [Scripts/cleanup-ghost-navigation.ts](Scripts/cleanup-ghost-navigation.ts). Runs dry by default; pass `--apply` to delete.
- ~~**`react-drag-reorder` dependency**~~ — dropped; native-HTML5 DnD rewrite replaced it.
- ~~**Dead-dep / peer-conflict cleanup**~~ — dropped `@react-buddy/ide-toolbox-next` (unused IDE helper, pinned `next@<=13`), `react-glidejs` (unused, pinned `react@^16`), `react-scripts` + `@svgr/webpack` + `cra-template-typescript` (CRA leftovers, pinned `typescript@^4`), `uppload-react` (unused wrapper; `uppload` core stays), `draftjs-to-html` + `html-to-draftjs` + their `@types/*` (CKEditor 5 has been the sole rich-text editor for a while). Migrated `src/Server/index.ts` off the deprecated `express-graphql` to `graphql-http` (already in deps) so `graphql@16` no longer triggers a peer conflict; dropped `express-graphql` + `graphql-tools` + `graphql-playground-middleware-express`. Pinned `micro` to `^9.4.1` to satisfy `apollo-server-micro@3`'s peer constraint (we never imported `micro` directly). Net effect: `npm install` runs clean **without** `--legacy-peer-deps` for the first time.
