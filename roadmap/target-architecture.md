# Target architecture — redis-node-js-cloud

The shape we're migrating toward. Visual reference: [folder-reorg-extensible.html](folder-reorg-extensible.html).

## Top-level layout

```
ui/
├── client/     # public-site render — everything a visitor (browser or future mobile) sees
└── admin/     # CMS editor — everything an author uses to write content

services/      # GraphQL server + API contract + domain services
shared/        # cross-cutting contracts (types, enums, utils, per-module schemas)
tools/         # cross-app automation (scripts/, codegen, seed, migrations)
infra/         # Dockerfiles, compose.yaml, certificates
docs/          # ROADMAP, THEMING, PROJECT_ANALYSIS, roadmap/
README.md      # stays at repo root
Secrets.md     # stays where it is (not moved)
package.json   # locked at repo root
```

## ui/client — render concern

```
ui/client/
├── pages/              # Next.js routing (convention-locked)
├── public/             # static assets
├── features/           # read-side capabilities + site chrome
│   ├── top-bar/        # site header bar
│   ├── mobile-nav/     # hamburger + drawer
│   ├── logo/           # logo resolver + render
│   ├── footer/         # site footer
│   ├── navigation/     # renders nav entries from pages
│   └── themes/         # applies active theme tokens at runtime
├── assets/             # image renderer + asset resolution
├── i18n/               # language switcher, i18n runtime, translation loader
├── styles/             # scss tokens + globals
└── modules/            # section blocks — placed inside page sections
    ├── hero/           # Hero.tsx, hero.scss, i18n/, index.ts (registers display)
    ├── gallery/ carousel/
    ├── text/ rich-text/
    ├── services/ timeline/ stats/
    ├── testimonials/ project-grid/
    └── social-links/ manifesto/
```

## ui/admin — edit concern

```
ui/admin/
├── shell/              # AdminApp, tab chrome, auth guard
├── features/           # write-side capabilities — delete-by-folder
│   ├── auth/           # login UI, session hook
│   ├── users/          # CRUD + password change
│   ├── navigation/     # pages + nav editing
│   ├── themes/         # preset editor, font picker
│   ├── languages/      # translation tables
│   ├── bundle/         # export / import
│   └── dialogs/        # ModulePickerDialog, confirm dialogs
├── modules/            # editor side of each content block
│   ├── hero/           # HeroEditor.tsx, hero-editor.scss, index.ts (registers editor)
│   ├── gallery/ carousel/ text/ rich-text/
│   ├── services/ timeline/ stats/ testimonials/
│   └── project-grid/ social-links/ manifesto/
├── assets/             # upload, logo, picker — top-level write-side
└── styles/             # admin-only scss (chrome, tabs, drawers)
```

## services — data concern

```
services/
├── features/           # resolvers split by feature — mirrors admin/
│   ├── auth/           # login, session, password reset
│   ├── users/          # user CRUD resolvers
│   ├── navigation/     # pages + nav resolvers
│   ├── themes/         # theme CRUD + font metadata
│   └── bundle/         # export / import
├── assets/             # upload handler, file storage resolvers
├── i18n/               # language + translation storage
├── modules/            # generic section persistence — read/write any section module
├── api/                # API surface — schema is the contract, client is generated
│   ├── schema.graphql  # master schema — hand-edited source of truth
│   └── generated/      # gqty client output — regenerated from schema, never hand-edited
├── infra/              # mongo, redis, fs, NextAuth adapters
└── index.ts            # Docker entrypoints
    sslServer.ts
```

## shared — cross-cutting contracts

```
shared/
├── types/              # IUser, ISection, ITheme, IItem — generic section/item shape
├── enums/              # EItemType, EStyle, EAnimation
└── utils/              # sanitize, date helpers, slugify
```

Section modules share the generic `ISection` / `IItem` types in `shared/types/`. No per-module schema folder — modules that need extra fields live inside `IItem.content` (JSON string) as today.

## Import rules — one dependency direction

| From | May import | Must NOT import |
|------|------------|-----------------|
| `ui/client/modules/*` | `shared/types`, `shared/enums`, `ui/client/features`, `ui/client/styles` | `ui/admin/*`, other modules' code |
| `ui/client/pages`, `ui/client/features` | `ui/client/modules/*`, `shared/*` | `ui/admin/*`, `services/*` |
| `ui/admin/modules/*` | `shared/types`, `shared/enums`, `ui/admin/features/dialogs`, `ui/admin/styles` | `ui/client/*`, other modules' code |
| `ui/admin/shell`, `ui/admin/features` | `ui/admin/modules/*`, `shared/*` | `ui/client/*`, `services/*` |
| `services/features` | `services/infra`, `shared/*` | `ui/*` |
| `shared/` (all subfolders) | nothing (leaf — types + pure utils only) | everything else |

Enforce with `eslint-plugin-import` + `no-restricted-imports`.

## Anatomy of a section module — by concern

```
ui/client/modules/hero/    # RENDER — display only
├── Hero.tsx               # public-site render
├── hero.scss
├── i18n/en.json
└── index.ts               # registers display component

ui/admin/modules/hero/     # EDIT — editor only
├── HeroEditor.tsx         # content + style form
├── hero-editor.scss
├── i18n/en.json
└── index.ts               # registers editor component
```

CONTRACT: the existing `ISection` / `IItem` types in `shared/types/` already cover every section module. Hero-specific fields live inside `IItem.content` (JSON string) exactly as today.

Section modules persist via the generic section resolver (`services/modules/`) — no per-module services folder.
Features that DO need their own data layer (blog, scene-3d…) get a `services/features/<name>/` slice instead.

## Design aims

- **One concern per folder.** "Where do I render a module?" → `ui/client/modules/`. "Edit it?" → `ui/admin/modules/`. "Change the section type?" → `shared/types/ISection.ts`. "Add a resolver?" → `services/features/<name>/`.
- **Self-explanatory names.** `ui/client/modules/hero/`, not `components/A123/`.
- **≤400 code lines per file** (imports excluded).
- **Delete-by-folder.** Removing a module = drop 2 folders (`ui/client/modules/X`, `ui/admin/modules/X`) + unregister it from the registry.
- **`ui/client` and `ui/admin` never import each other.** Enforced by ESLint, not review.
- **`shared/` is a leaf.** Types + pure utils only; no side effects.

## Extension recipes

| Want to add… | Touch |
|---|---|
| A new section module (e.g. "FAQ") | `ui/client/modules/faq/` + `ui/admin/modules/faq/` + one registry entry. No services change — section persistence is generic via `ISection`/`IItem`. |
| Blog feature | `ui/client/features/blog/` + `ui/admin/features/blog/` + `services/features/blog/`. |
| 3D scenes feature | `ui/client/features/scene-3d/` + `ui/admin/features/scene-3d/` + `services/features/scene-3d/`. |
| 2D animation feature | `ui/client/features/animation-2d/` + `ui/admin/features/animation-2d/`. Services optional. |
| A new admin capability | `ui/admin/features/<name>/` + `services/features/<name>/`. Client untouched. |
| Android / mobile app | Create `ui/client/mobile/`. Imports `ui/client/modules/*` + `ui/client/features/*` + `shared/*`. |

## Known migration blockers — resolve before Phase 1

Full critique: see review notes. Key items the reorg plan must answer:

1. **Next project root** — stays at `src/frontend` (rename inside) or moves to repo root (rewrite every build script)? Current `package.json` passes `src/frontend` as a CLI arg to `next dev`/`next build`.
2. **Two `@/*` aliases collide** — `src/frontend/tsconfig.json` vs `src/Server/tsconfig.custom.json` both define `@/*`. Either give each side a distinct alias (`@client/*`, `@services/*`) or unify.
3. **`schema.graphql` path** — `src/Server/index.ts:25` hard-codes `readFileSync('./src/Server/schema.graphql')`. Must update if it moves to `services/api/schema.graphql`.
4. **`next-i18next.config.js` localePath** — hard-codes `./src/frontend/public/locales`.
5. **Docker COPY paths** — both Dockerfiles copy `./src`, `./Manifest.ts`, `./IP.ts`, `./Scripts`, `./certificates`, `./next-i18next.config.js`, `./next-sitemap.config.cjs`.
6. **compose.yaml volume mounts** — `./uploads/images:/app/src/frontend/public/images` and similar.
7. **gqty target + config** — `"gqty"` block lives in root `package.json`; scripts reference `src/frontend/gqty/index.ts`.
8. **NextAuth** — `pages/api/auth/[...nextauth].ts` lives under `ui/client/pages/` but `authOptions` logically belongs to `services/features/auth/`. Decide who owns session logic.
9. **`src/Interfaces/` → `shared/types/`** — rename or merge? Existing `IUser`, `ISection`, `ITheme` already shared today.
10. **Tests** — currently co-located (`src/Server/UserService.test.ts`). Confirm co-location survives the move; update `vitest.config.ts` globs.
11. **Service worker** — recent fix (commit `7a42a11`) unregistered stale SWs; ensure SW registration path survives.
12. **`Manifest.ts` + `IP.ts`** — top-level app config imported by Dockerfiles + server boot. Needs a new home (likely `shared/` or `services/infra/`).

## Implementation plan

Ordered execution. WebStorm Move refactor is the preferred tool for any `.ts`/`.tsx` relocation — it auto-rewrites imports and preserves `git mv` history. Everything else is manual.

1. **Plan what goes where.** Lock the mapping (old path → new path) in a table before touching anything. One commit per logical group listed below.
2. **`.gitignore` first.** Add the new top-level folders (`ui/`, `services/`, `shared/`, `tools/` if not already ignored where appropriate) and any paths that shouldn't track move artefacts. Commit before any file moves so git sees a clean baseline.
3. **Create the new folders.** Empty `ui/client/`, `ui/admin/`, `services/`, `shared/types/`, `shared/enums/`, `shared/utils/` etc. Empty commit or `.gitkeep` per folder.
4. **Move files — frontend first.**
   - `ui/client/modules/*` (from `src/frontend/components/SectionComponents/*`)
   - `ui/client/features/*` (top-bar, mobile-nav, logo, footer, navigation, themes runtime)
   - `ui/client/assets/`, `ui/client/i18n/`, `ui/client/styles/`
   - `ui/admin/modules/*` (from `src/frontend/components/Admin/ConfigComponents/*`)
   - `ui/admin/features/*` (from `src/frontend/components/Admin/AdminSettings/*` + dialogs)
   - `ui/admin/shell/`, `ui/admin/assets/`, `ui/admin/styles/`
5. **Move files — backend next.**
   - `services/features/*` (from `src/Server/*Service.ts` grouped by feature)
   - `services/modules/`, `services/assets/`, `services/i18n/`, `services/infra/`
   - `services/api/schema.graphql` (from `src/Server/schema.graphql`)
   - `services/api/generated/` (from `src/frontend/gqty/`)
   - `services/index.ts`, `services/sslServer.ts`
6. **Move files — rest.**
   - `shared/types/` (from `src/Interfaces/`)
   - `shared/enums/` (from `src/enums/`)
   - `shared/utils/` (from `src/constants/`, `src/helpers/`)
   - `tools/scripts/` (from `Scripts/`)
   - `infra/` (Dockerfiles, compose.yaml, certificates)
7. **Fix admin first.** Update admin-side imports, registry, dialog wiring, SCSS `@use`/`@import` paths, i18n namespaces. Verify admin boots + login works + module edit round-trips.
8. **Fix client next.** Update client imports, registry display side, public pages, service worker registration, i18next loader path, SCSS. Verify public site renders + SSR works.
9. **Fix production stuff.** Dockerfiles (`COPY` paths), `compose.yaml` volume mounts, `package.json` scripts (`next dev/build` target path), `next.config.js` (including `../../next-i18next.config.js` traversal), both `tsconfig.json` files (`@/*` alias — use `@client/*` vs `@services/*` to avoid collision), `vitest.config.ts` globs, `nodemon.json` watch paths, `next-sitemap.config.cjs`, gqty config in `package.json`. Verify Docker build + container boot + HTTPS.
10. **Fix `.md`s last.** `README.md` (stays at root), `ROADMAP.md`, `THEMING.md`, `DEPLOY.md`, `PROJECT_ANALYSIS.md`, `roadmap/*.md`, any inline doc paths. `Secrets.md` stays where it is.

### Why this order
- `.gitignore` first avoids committing noise during moves.
- Frontend → backend → rest groups files by owner so each commit is reviewable in isolation.
- Admin → client → production → docs mirrors blast radius: admin is internal, client is public, production is shared infra, docs are lowest-risk.

---

**Pragmatic path:** keep the Next root at `src/frontend` and apply the target shape *inside* it as a first pass (rename `SectionComponents` → `modules`, `Admin/ConfigComponents` → `admin/modules`, `Admin/AdminSettings` → `admin/features`; move `src/Server` → `src/services`, `src/Interfaces` → `src/shared/types`). That delivers most of the readability win with no config-file edits. A repo-root flattening can follow later as its own roadmap item once CI is green on the renamed tree.
