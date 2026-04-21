# Migration mapping — full flatten

Source path → target path for every file/folder. Paired with [target-architecture.md](target-architecture.md). Sign-off lock: nothing moves until this mapping is approved.

---

## ui/client — render concern

### Pages (Next convention-locked)
```
src/frontend/pages/                         → ui/client/pages/
├── 404.tsx, [..slug].tsx, _app.tsx, _document.tsx, app.tsx
├── index.tsx, admin.tsx
├── admin/languages.tsx, admin/settings.tsx
├── blog/[slug].tsx, blog/index.tsx
└── api/                                     → ui/client/pages/api/
    ├── [name].ts, auth/[...nextauth].ts, auth/authOptions.ts
    ├── export.ts, import.ts, upload.ts, presence.ts
    ├── graphql.ts, fonts/css.ts, fonts/file.ts
    ├── setup.ts, rescan-images.ts
    └── _authHelpers.ts, _origin.ts, _rateLimit.ts
```

**Decision needed:** `pages/api/auth/authOptions.ts` is convention-locked to `pages/` but logic belongs in `services/features/auth/`. Recommend: keep route thin, move logic to `services/features/auth/`, import back into the pages route.

### Public
```
src/frontend/public/                         → ui/client/public/
├── locales/{en,lv,lt,ru}/{app.json, common.json}
├── design-v2/
└── data-model.svg
```

### Features (read-side + chrome)
| Feature | Source | Target |
|---------|--------|--------|
| mobile-nav | `components/common/MobileNav.tsx` | `ui/client/features/mobile-nav/` |
| logo | `components/common/Logo.tsx` | `ui/client/features/logo/` |
| footer | `components/common/SiteFooter.tsx` | `ui/client/features/footer/` |
| navigation | `components/common/ScrollNav.tsx` | `ui/client/features/navigation/` |
| themes | `src/frontend/theme/` (7 files) | `ui/client/features/themes/` |
| presence | `components/common/PresenceBar.tsx` | `ui/client/features/presence/` |
| top-bar | *not found — likely embedded in `_app.tsx` or `pages/index.tsx`* | `ui/client/features/top-bar/` |

### Shared client UI (not features)
```
components/common/{ConflictDialog,RevealOnScroll,EditableTags,EditWrapper,ContentType,HighContrastAutoPick}.tsx
  → ui/client/lib/   (or ui/client/shared-components/)
```

### Assets + i18n + styles
```
src/frontend/api/AssetApi.ts                 → services/api/client/  (API call, not storage)
src/frontend/Classes/UpploadeManager.ts      → services/infra/
src/frontend/admin-locales/                  → ui/admin/i18n/
src/frontend/lib/adminI18n.ts                → ui/admin/i18n/
src/frontend/scss/
  ├── global.scss, app.scss, base-colors.scss → ui/client/styles/globals/
  ├── Layout/*, Common/*                      → ui/client/styles/
  ├── Themes/*, Components/*                  → per-module .scss (copy into each module)
  └── Admin/*                                 → ui/admin/styles/
```

### Modules (display)
```
src/frontend/components/SectionComponents/   → ui/client/modules/
├── Hero.tsx         → hero/Hero.tsx           + hero/hero.scss + hero/index.ts
├── Gallery.tsx      → gallery/
├── CarouselView.tsx → carousel/
├── RichText.tsx     → rich-text/
├── PlainText.tsx    → plain-text/
├── PlainImage.tsx   → plain-image/
├── Services.tsx     → services/
├── Timeline.tsx     → timeline/
├── StatsCard.tsx    → stats-card/
├── Testimonials.tsx → testimonials/
├── ProjectCard.tsx  → project-card/
├── ProjectGrid.tsx  → project-grid/
├── SkillPills.tsx   → skill-pills/
├── SocialLinks.tsx  → social-links/
├── Manifesto.tsx    → manifesto/
├── BlogFeed.tsx     → blog-feed/
└── List.tsx         → list/
Each module's index.ts registers the display component with the registry.
```

---

## ui/admin — edit concern

### Shell
```
src/frontend/components/Admin/                → ui/admin/shell/
├── AdminApp.tsx, AdminSettings.tsx
├── UserStatusBar.tsx, AuditBadge.tsx
├── AutosaveStatus.tsx, UndoStatusPill.tsx
└── CommandPalette.tsx
```

### Features
| Feature | Source | Target |
|---------|--------|--------|
| auth | `pages/api/auth/authOptions.ts`, `components/Auth/login-btn.tsx` | `ui/admin/features/auth/` |
| users | `Admin/AdminSettings/Users.tsx` | `ui/admin/features/users/` |
| navigation | `AdminSettings/Layout.tsx`, `Dialogs/AddNewDialogNavigation.tsx`, `ImageRail.tsx` | `ui/admin/features/navigation/` |
| themes | `AdminSettings/Theme.tsx`, `FontPicker.tsx`, `ThemePreviewFrame.tsx` | `ui/admin/features/themes/` |
| languages | `AdminSettings/Languages.tsx`, `AddNewLanguageDialog.tsx`, `languagePresets.ts` | `ui/admin/features/languages/` |
| bundle | `AdminSettings/Bundle.tsx`, `ContentLoader.tsx`, `ContentLoaderCompare.tsx`, `CsvImportDialog.tsx` | `ui/admin/features/bundle/` |
| publishing | `AdminSettings/Publishing.tsx` | `ui/admin/features/publishing/` |
| footer | `AdminSettings/Footer.tsx` | `ui/admin/features/footer/` |
| seo | `AdminSettings/SEO.tsx` | `ui/admin/features/seo/` |
| logo | `AdminSettings/LogoSettings.tsx`, `Dialogs/LogoEditDialog.tsx` | `ui/admin/features/logo/` |
| posts | `AdminSettings/Posts.tsx` | `ui/admin/features/posts/` |
| audit | `AdminSettings/AuditTab.tsx` | `ui/admin/features/audit/` |
| dialogs | `ModulePicker/ModulePickerDialog.tsx`, `common/Dialogs/*` | `ui/admin/features/dialogs/` |

### Modules (editor)
```
src/frontend/components/Admin/ConfigComponents/ → ui/admin/modules/
├── InputHero.tsx         → hero/HeroEditor.tsx + index.ts
├── InputGallery.tsx      → gallery/
├── InputCarousel.tsx     → carousel/
├── InputRichText.tsx     → rich-text/
├── InputPlainText.tsx    → plain-text/
├── InputPlainImage.tsx   → plain-image/
├── InputServices.tsx     → services/
├── InputTimeline.tsx     → timeline/
├── InputStatsCard.tsx    → stats-card/
├── InputTestimonials.tsx → testimonials/
├── InputProjectCard.tsx  → project-card/
├── InputProjectGrid.tsx  → project-grid/
├── InputSkillPills.tsx   → skill-pills/
├── InputSocialLinks.tsx  → social-links/
├── InputManifesto.tsx    → manifesto/
├── InputBlogFeed.tsx     → blog-feed/
└── InputList.tsx         → list/
Each module's index.ts registers the editor component with the registry.
```

### Admin assets + styles
```
components/Admin/ImageRail.tsx, ImageRailDock.tsx → ui/admin/assets/
src/frontend/scss/Admin/
  ├── AddNewSection.scss, EditSection.scss, AdminPlainImage.scss
  ├── ImageUpload.scss, InlineTranslate.scss, InputGallery.scss
  ├── Login.scss, Navigation.scss, app.scss
  → ui/admin/styles/
```

---

## shared — cross-cutting contracts

### Types
```
src/Interfaces/                              → shared/types/
├── IUser.ts, ISection.ts, IItem.ts
├── IPage.ts, INavigation.ts, IPost.ts
├── ITheme.ts, IFooter.ts, ILogo.ts, ISeo.ts, ISiteSeo.ts
├── IImage.ts, IMongo.ts, IInputContent.ts
├── IContentTypeProps.ts, IConfigSectionAddRemove.ts

src/frontend/components/interfaces/INewLanguage.ts
  → shared/types/ILanguage.ts
```

### Enums
```
src/enums/                                   → shared/enums/
├── EItemType.ts, EAnimation.ts, EStyle.ts, ETextPosition.ts
```

### Utils (pure, no side effects)
```
src/constants/imgPath.ts                     → shared/utils/constants.ts
src/helpers/guid.ts                          → shared/utils/guid.ts
src/frontend/lib/conflict.ts                 → shared/utils/conflict.ts
src/frontend/lib/refreshBus.ts               → shared/utils/refreshBus.ts
src/frontend/lib/gqlFetch.ts                 → ui/client/lib/   (client-specific)
```

---

## services — data concern

### Features
```
src/Server/                                  → services/features/<domain>/

auth/         authz.ts, authz.test.ts, initialPassword.ts, UserService.ts (+test)
navigation/   NavigationService.ts (+test)
themes/       ThemeService.ts (+test)
languages/    LanguageService.ts (+test), TranslationMetaService.ts
bundle/       BundleService.ts (+test), PublishService.ts (+test)
footer/       FooterService.ts (+test)
posts/        PostService.ts
audit/        AuditService.ts, audit.ts
presence/     PresenceService.ts
seo/          SiteSeoService.ts (+test), SiteFlagsService.ts (+test)
assets/       AssetService.ts (+test)
```

### Infra
```
src/Server/mongoConfig.ts, mongoDBConnection.ts → services/infra/
src/Server/redisConnection.ts                   → services/infra/
src/Server/fileManager.ts                       → services/infra/
```

### API surface
```
src/Server/schema.graphql                    → services/api/schema.graphql
src/frontend/gqty/                           → services/api/generated/
  ├── index.ts, schema.generated.ts
```

### Entrypoints
```
src/Server/index.ts                          → services/index.ts
src/Server/sslServer.ts                      → services/sslServer.ts
src/Server/tsconfig.custom.json              → services/tsconfig.custom.json
  (path alias "@/*": ["./src/Server/*"] → ["./services/*"])
```

---

## tools — automation

```
Scripts/                                     → tools/scripts/
├── cleanup-ghost-navigation.ts, update-google-fonts.ts
├── deploy.sh, generateSsl.sh, installMongoDB.sh, startMongo.sh
├── merge-admin-locales.js
└── server-init.sh, dev.sh, run.sh, runDevServer.sh
```

---

## infra — containerization

```
AppDockerfile                                → infra/AppDockerfile
ServerDockerfile                             → infra/ServerDockerfile
compose.yaml                                 → infra/compose.yaml
certificates/                                → infra/certificates/
```

---

## docs

```
roadmap/                                     → docs/roadmap/
THEMING.md, DEPLOY.md, PROJECT_ANALYSIS.md   → docs/
ROADMAP.md                                   → docs/ROADMAP.md
README.md                                    → stay at repo root
Secrets.md                                   → stay where it is
```

---

## Hard-coded paths to update (Phase 1 config surgery)

| File | Line | Current | New |
|------|------|---------|-----|
| `src/Server/index.ts` | 25 | `readFileSync('./src/Server/schema.graphql')` | `'./services/api/schema.graphql'` |
| `next-i18next.config.js` | 222 | `path.resolve('./src/frontend/public/locales')` | `'./ui/client/public/locales'` |
| `next-sitemap.config.cjs` | 9–10 | `sourceDir: "src/frontend/.next"`, `outDir: "src/frontend/public/images"` | `ui/client/.next`, `ui/client/public/images` |
| `package.json` | 7 | `"dev": "next dev --turbo -p 80 src/frontend"` | `ui/client` |
| `package.json` | 10 | `"build": "... next build src/frontend"` | `ui/client` |
| `package.json` | 19 | `"generate-schema": "... --target=src/frontend/gqty/index.ts"` | `services/api/generated/index.ts` |
| `package.json` | 16–18 | `"standalone-graphql": "... src/Server/tsconfig.custom.json src/Server/index.ts"` | `services/tsconfig.custom.json services/index.ts` |
| `src/frontend/next.config.js` | 1 | `require('../../next-i18next.config.js')` | adjust traversal after move |
| `AppDockerfile`, `ServerDockerfile` | 32–44 | `COPY ./src ./src`, `./Manifest.ts`, `./IP.ts`, `./Scripts`, `./certificates`, `./next-i18next.config.js`, `./next-sitemap.config.cjs`, `./nodemon.json` | all new paths |
| `compose.yaml` | 69–70 | `./uploads/images:/app/src/frontend/public/images` | `/app/ui/client/public/images` |
| `vitest.config.ts` | 9, 11 | `'src/**/*.{test,spec}.{ts,tsx}'`, `['src/frontend/**...']` | new globs |
| `nodemon.json` | watch paths | `src/Server` | `services` |
| `package.json` `"gqty"` block | all paths | `src/frontend/gqty/...` | `services/api/generated/...` |

---

## Cross-cutting import patterns (expected rewrites)

**Frontend → Server crossing (currently via `pages/api/*`):**
```
// src/frontend/pages/api/export.ts
import {getMongoConnection} from '../../../Server/mongoDBConnection'

// after:
// ui/client/pages/api/export.ts
import {getMongoConnection} from '../../../services/infra/mongoDBConnection'
```

**`@/*` alias collision resolution:**
```
src/frontend/tsconfig.json      @/* = ./src/*       → split into @client/* = ./ui/client/*
src/Server/tsconfig.custom.json @/* = ./src/Server/* → @services/* = ./services/*
```

**Frontend importing `Interfaces/`:**
```
import {InImage} from '@/Interfaces/IImage'
  → import {InImage} from 'shared/types/IImage'
```

---

## Ambiguities — decide before moving

1. **NextAuth location** — keep routes in `ui/client/pages/api/auth/`, move logic to `services/features/auth/`, re-export from the route.
2. **Top-bar feature** — not found; check `_app.tsx` and `pages/index.tsx` first.
3. **`conflict.ts` / `refreshBus.ts`** — assumed pure (`shared/utils/`); verify no side effects.
4. **`IP.ts` + `Manifest.ts`** — server boot + Dockerfile dependencies; recommend `services/infra/` (or `shared/config/` if frontend also imports).
5. **`@/*` alias split** — `@client/*` vs `@services/*` vs keep unified (single-pkg setup).
6. **Top-level root files not mentioned** — `data/`, `mongo_data/`, `uploads/`, `var/`, `__mocks__/` — most are runtime data / gitignored; confirm before moving.

---

## Tests — co-location survives

Already co-located (`UserService.test.ts` next to source). After move, update only `vitest.config.ts` globs:
```
include: [
  'ui/client/**/*.{test,spec}.{ts,tsx}',
  'ui/admin/**/*.{test,spec}.{ts,tsx}',
  'services/**/*.{test,spec}.{ts,tsx}',
  'shared/**/*.{test,spec}.{ts,tsx}'
]
```

---

## Service worker

No standalone SW file. Unregistration logic in `src/frontend/pages/_app.tsx:58–65` (commit `7a42a11`). Moves with `_app.tsx` → `ui/client/pages/_app.tsx`. Uses `navigator.serviceWorker.getRegistrations()` — no hard-coded paths.

---

## Implementation checklist

- [ ] Lock the mapping (this document)
- [ ] Update `.gitignore` for new top-level folders
- [ ] Create empty target folders (`.gitkeep` per folder)
- [ ] Move `.ts`/`.tsx` files with WebStorm Move refactor (auto-rewrites imports)
- [ ] Move non-code files (scss, graphql, md, json) manually with `git mv`
- [ ] Update all hard-coded paths per the table above
- [ ] Split `@/*` alias or unify tsconfig
- [ ] Update `package.json` scripts, `vitest.config.ts`, `nodemon.json`, gqty config
- [ ] Update Dockerfiles + `compose.yaml`
- [ ] Test: `npm run dev` → admin boots, login works, module edit round-trips
- [ ] Test: public site renders + SSR
- [ ] Test: `docker compose build && docker compose up`
- [ ] Update `README.md` paths (last)
