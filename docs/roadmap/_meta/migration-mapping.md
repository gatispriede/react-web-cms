# Migration mapping — full flatten

Source path → target path for every file/folder. Paired with [target-architecture.md](target-architecture.md) and [folder-reorg-extensible.html](folder-reorg-extensible.html). Sign-off lock: nothing moves until this mapping is approved.

**Casing convention (ratified 2026-04):**
- **lowercase** for concern/layer folders: `ui/`, `client/`, `admin/`, `modules/`, `features/`, `shell/`, `services/`, `shared/`, `infra/`, `tools/`, `docs/`, `styles/`, `pages/`, `public/`, `lib/`, `api/`
- **PascalCase** for module/feature folders that map 1:1 to a React component or domain name: `Hero/`, `Gallery/`, `RichText/`, `TopBar/`, `Auth/`, `Languages/`
- **PascalCase** for component files, types, stylesheets, and barrels within a module: `Hero.tsx`, `Hero.types.ts`, `Hero.scss`, `HeroEditor.tsx`, `index.ts`

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

**Decision:** `pages/api/auth/authOptions.ts` is convention-locked to `pages/`. Keep the route thin; logic lives in `services/features/Auth/`. Cross-concern leak already resolved by DI'ing `authOptions` into `sessionFromReq`.

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
| MobileNav | `components/common/MobileNav.tsx` | `ui/client/features/MobileNav/` |
| Logo | `components/common/Logo.tsx` | `ui/client/features/Logo/` |
| Footer | `components/common/SiteFooter.tsx` | `ui/client/features/Footer/` |
| Navigation | `components/common/ScrollNav.tsx` | `ui/client/features/Navigation/` |
| Themes | `src/frontend/theme/` (7 files) | `ui/client/features/Themes/` |
| Presence | `components/common/PresenceBar.tsx` | `ui/client/features/Presence/` |
| TopBar | *embedded in `_app.tsx` / `pages/index.tsx`* | `ui/client/features/TopBar/` |

### Shared client UI (not features)
```
components/common/{ConflictDialog,RevealOnScroll,EditableTags,EditWrapper,ContentType,HighContrastAutoPick}.tsx
  → ui/client/lib/
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
├── Hero.tsx         → Hero/Hero.tsx + Hero/Hero.scss + Hero/Hero.types.ts + Hero/index.ts
├── Gallery.tsx      → Gallery/
├── CarouselView.tsx → Carousel/   (default export still named CarouselView)
├── RichText.tsx     → RichText/
├── PlainText.tsx    → PlainText/
├── PlainImage.tsx   → PlainImage/   (enum kept as EImageStyle)
├── Services.tsx     → Services/
├── Timeline.tsx     → Timeline/
├── StatsCard.tsx    → StatsCard/
├── Testimonials.tsx → Testimonials/
├── ProjectCard.tsx  → ProjectCard/
├── ProjectGrid.tsx  → ProjectGrid/
├── SkillPills.tsx   → SkillPills/
├── SocialLinks.tsx  → SocialLinks/   (also re-exports PLATFORM_ICONS)
├── Manifesto.tsx    → Manifesto/
├── BlogFeed.tsx     → BlogFeed/
└── List.tsx         → List/
```
Each `<Name>/index.ts` barrel:
```ts
import <Name> from './<Name>';
export default <Name>;
export {<Name>Content} from './<Name>';
export {E<Name>Style, type I<Name> /*, ...*/} from './<Name>.types';
```

**Interim location:** currently at `src/frontend/modules/<Name>/` — will hoist to `ui/client/modules/<Name>/` when `src/frontend/` → `ui/client/` rename lands.

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
| Auth | `pages/api/auth/authOptions.ts` (logic), `components/Auth/login-btn.tsx` | `ui/admin/features/Auth/` |
| Users | `Admin/AdminSettings/Users.tsx` | `ui/admin/features/Users/` |
| Navigation | `AdminSettings/Layout.tsx`, `Dialogs/AddNewDialogNavigation.tsx`, `ImageRail.tsx` | `ui/admin/features/Navigation/` |
| Themes | `AdminSettings/Theme.tsx`, `FontPicker.tsx`, `ThemePreviewFrame.tsx` | `ui/admin/features/Themes/` |
| Languages | `AdminSettings/Languages.tsx`, `AddNewLanguageDialog.tsx`, `languagePresets.ts` | `ui/admin/features/Languages/` |
| Bundle | `AdminSettings/Bundle.tsx`, `ContentLoader.tsx`, `ContentLoaderCompare.tsx`, `CsvImportDialog.tsx` | `ui/admin/features/Bundle/` |
| Publishing | `AdminSettings/Publishing.tsx` | `ui/admin/features/Publishing/` |
| Footer | `AdminSettings/Footer.tsx` | `ui/admin/features/Footer/` |
| Seo | `AdminSettings/SEO.tsx` | `ui/admin/features/Seo/` |
| Logo | `AdminSettings/LogoSettings.tsx`, `Dialogs/LogoEditDialog.tsx` | `ui/admin/features/Logo/` |
| Posts | `AdminSettings/Posts.tsx` | `ui/admin/features/Posts/` |
| Audit | `AdminSettings/AuditTab.tsx` | `ui/admin/features/Audit/` |
| Dialogs | `ModulePicker/ModulePickerDialog.tsx`, `common/Dialogs/*` | `ui/admin/features/Dialogs/` |

### Modules (editor)
```
src/frontend/components/Admin/ConfigComponents/ → ui/admin/modules/
├── InputHero.tsx         → Hero/HeroEditor.tsx + Hero/index.ts
├── InputGallery.tsx      → Gallery/
├── InputCarousel.tsx     → Carousel/
├── InputRichText.tsx     → RichText/
├── InputPlainText.tsx    → PlainText/
├── InputPlainImage.tsx   → PlainImage/
├── InputServices.tsx     → Services/
├── InputTimeline.tsx     → Timeline/
├── InputStatsCard.tsx    → StatsCard/
├── InputTestimonials.tsx → Testimonials/
├── InputProjectCard.tsx  → ProjectCard/
├── InputProjectGrid.tsx  → ProjectGrid/
├── InputSkillPills.tsx   → SkillPills/
├── InputSocialLinks.tsx  → SocialLinks/
├── InputManifesto.tsx    → Manifesto/
├── InputBlogFeed.tsx     → BlogFeed/
└── InputList.tsx         → List/
```
Rename `Input<Name>` → `<Name>Editor` at move time. Each `<Name>/index.ts` barrel exports `<Name>Editor` named.

**Interim location:** currently at `src/frontend/admin/modules/<Name>/` — hoists to `ui/admin/modules/<Name>/` with the `src/frontend/` rename.

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
└── INewLanguage.ts  (already moved here from components/interfaces/ in Phase 1)
```

### Enums
```
src/enums/                                   → shared/enums/
├── EItemType.ts, EAnimation.ts, EStyle.ts, ETextPosition.ts
```

### Utils (pure, no side effects)
```
src/utils/guid.ts                            → shared/utils/guid.ts       (moved from helpers/)
src/utils/imgPath.ts                         → shared/utils/imgPath.ts    (moved from constants/)
src/frontend/lib/conflict.ts                 → shared/utils/conflict.ts
src/frontend/lib/refreshBus.ts               → shared/utils/refreshBus.ts
src/frontend/lib/gqlFetch.ts                 → ui/client/lib/   (client-specific)
```

**Path aliases (already in place):** `@interfaces`, `@enums`, `@utils`, `@api`, `@server` configured in `vitest.config.ts`, `src/frontend/tsconfig.json`, `src/Server/tsconfig.custom.json`.

---

## services — data concern

### Features (PascalCase domain folders)
```
src/Server/                                  → services/features/<Domain>/

Auth/         authz.ts, authz.test.ts, initialPassword.ts, UserService.ts (+test)
Navigation/   NavigationService.ts (+test)
Themes/       ThemeService.ts (+test)
Languages/    LanguageService.ts (+test), TranslationMetaService.ts
Bundle/       BundleService.ts (+test), PublishService.ts (+test)
Footer/       FooterService.ts (+test)
Posts/        PostService.ts
Audit/        AuditService.ts, audit.ts
Presence/     PresenceService.ts
Seo/          SiteSeoService.ts (+test), SiteFlagsService.ts (+test)
Assets/       AssetService.ts (+test)
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
// before:  import {getMongoConnection} from '../../../Server/mongoDBConnection'
// after:   import {getMongoConnection} from '../../../services/infra/mongoDBConnection'
```

**`@/*` alias collision resolution:**
```
src/frontend/tsconfig.json      @/* = ./src/*       → @client/*   = ./ui/client/*
src/Server/tsconfig.custom.json @/* = ./src/Server/* → @services/* = ./services/*
```

**Cross-tree contracts:**
```
// before:  import {InImage} from '@/Interfaces/IImage'
// after:   import {InImage} from '@interfaces/IImage'   (via alias, already live)
// later:   '@shared/types/IImage' after Interfaces → shared/types rename
```

**Registry import (the one bindable seam between client and admin):**
```ts
// src/frontend/components/itemTypes/registry.ts
import Hero,     {EHeroStyle}     from '../../modules/Hero';
import HeroEditor from '../../admin/modules/Hero'; // named export
// ...repeat for all 17 modules
```

---

## Verification checklist — current state (2026-04-23)

### Done
- [x] `src/Interfaces/INewLanguage.ts` — moved from `components/interfaces/`
- [x] `src/utils/guid.ts`, `src/utils/imgPath.ts` — moved from `helpers/`, `constants/`
- [x] Path aliases `@interfaces @enums @utils @api @server` — live in vitest + both tsconfigs
- [x] Server → frontend layering leak (authOptions) — resolved via DI into `sessionFromReq`
- [x] 17 × `src/frontend/modules/<Name>/<Name>.tsx` — moved + renamed
- [x] 17 × `src/frontend/modules/<Name>/<Name>.types.ts` — types split out
- [x] 17 × `src/frontend/modules/<Name>/<Name>.scss` — stylesheets moved
- [x] 17 × `src/frontend/modules/<Name>/index.ts` — barrels in place
- [x] 17 × `src/frontend/admin/modules/<Name>/<Name>Editor.tsx` — moved + renamed from Input<Name>
- [x] Docs: `target-architecture.md`, `folder-reorg-extensible.html` updated for PascalCase

### Broken — fix next
- [ ] `src/frontend/components/itemTypes/registry.ts` — imports still reference deleted `../../Features/Sections/<Name>` paths; retarget to `../../modules/<Name>` + `../../admin/modules/<Name>`
- [ ] `src/frontend/scss/global.scss` — `@use "../Features/Sections/<Name>/<Name>"` → `@use "../modules/<Name>/<Name>"`
- [ ] 17 × `<Name>.tsx` — internal imports (`../../../components/ContentManager`, `../common/*`) use pre-move depth
- [ ] 17 × `<Name>Editor.tsx` — sibling refs (`./Gallery`, `./<Name>` for content classes) now cross-tree; rewrite to `../../modules/<Name>` (and back into `../` for admin siblings)
- [ ] 17 × `admin/modules/<Name>/index.ts` — barrel file not yet created

### Future phases (pragmatic target, not yet started)
- [ ] `src/Server/` → `src/services/`
- [ ] `src/Interfaces/` → `src/shared/types/`
- [ ] `src/enums/` → `src/shared/enums/`
- [ ] `src/utils/` → `src/shared/utils/`
- [ ] `src/frontend/components/Admin/AdminSettings/` split into `src/frontend/admin/features/<Name>/`
- [ ] `src/frontend/` → `ui/client/` hoist (repo-root reshape)
- [ ] Hard-coded paths table above
- [ ] `eslint-plugin-import` rule: `ui/client` ↮ `ui/admin` isolation

---

## Tests — co-location survives

Already co-located. After reshape, `vitest.config.ts` globs become:
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

No standalone SW file. Unregistration logic in `src/frontend/pages/_app.tsx:58–65`. Moves with `_app.tsx` → `ui/client/pages/_app.tsx`. No hard-coded paths.
