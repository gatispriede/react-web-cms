# Project Analysis — redis-node-js-cloud

## Overview

Despite the name, this is a **Next.js 15 / React 19 CMS** backed by **MongoDB** (Redis is present but nearly unused). It lets an admin compose multilingual pages from reusable content sections (gallery, carousel, rich text, plain image/text) behind a navigation tree, with SEO metadata per page.

- **Framework:** Next.js 15 (pages router), React 19, TypeScript 5
- **UI:** Ant Design v5 + custom SCSS, CKEditor 5 (with legacy draft-js still in tree)
- **API:** GraphQL via Apollo Server (Next API route) **and** a standalone Express + `express-graphql` server
- **Data:** MongoDB 7 (primary), Redis (one trivial `getBar` resolver)
- **Auth:** NextAuth (Credentials + optional Google), bcrypt password hashing
- **i18n:** `next-i18next`, language detection via `@unly/universal-language-detector`
- **Build/deploy:** Docker Compose (mongodb + standalone GraphQL server + Next app)

## Repository layout

```
.
├── AppDockerfile              Next.js app image
├── ServerDockerfile           Standalone GraphQL server image
├── compose.yaml               mongodb + server + app stack
├── next-i18next.config.js     Locale + translation backend config
├── next-sitemap.config.cjs    Sitemap generation (postbuild)
├── Scripts/                   Helper scripts
├── certificates/              Local SSL certs (sslServer.ts consumes these)
└── src/
    ├── Api/                   Shared API helpers
    ├── Interfaces/            Domain types (IUser, INavigation, ISection, …)
    ├── Server/                Backend — standalone GraphQL + Mongo/Redis
    │   ├── index.ts           Express + express-graphql entry
    │   ├── sslServer.ts       HTTPS variant
    │   ├── schema.graphql     Single source of truth for the GraphQL API
    │   ├── mongoConfig.ts     Settings + service interfaces
    │   ├── mongoDBConnection.ts  Singleton orchestrator that wires the services
    │   ├── UserService.ts     setupAdmin / addUser / getUser
    │   ├── NavigationService.ts  Pages, sections CRUD + nav mutations
    │   ├── AssetService.ts    Logo + images
    │   ├── LanguageService.ts Language + translations
    │   ├── BundleService.ts   Single-file site export/import
    │   ├── fileManager.ts     Filesystem helpers
    │   └── redisConnection.ts Redis client (minimal use)
    ├── frontend/              Next.js app
    │   ├── pages/
    │   │   ├── _app.tsx, _document.tsx
    │   │   ├── index.tsx, app.tsx       Public site shell
    │   │   ├── [...slug].tsx            Dynamic page routing by slug
    │   │   ├── admin.tsx, admin/…       Admin panel
    │   │   └── api/
    │   │       ├── auth/[...nextauth].ts   NextAuth route
    │   │       ├── graphql.ts              Apollo Server (serverless)
    │   │       ├── upload.ts               File upload handler
    │   │       ├── setup.ts                Seed admin user (GET/POST)
    │   │       ├── export.ts               Site bundle download (GET)
    │   │       ├── import.ts               Site bundle upload (POST)
    │   │       └── [name].ts               Catch-all API helper
    │   ├── components/
    │   │   ├── Admin/            AdminApp, AdminSettings (Users/Languages/Theme/Bundle), config inputs
    │   │   ├── Auth/             login-btn
    │   │   ├── SectionComponents/  Gallery, Carousel, RichText, PlainImage, PlainText (+ style enums)
    │   │   ├── itemTypes/        registry.ts — pairs Display + Editor per EItemType
    │   │   ├── common/           Dialogs, wrappers, SectionErrorBoundary, Logo, RichTextEditor
    │   │   └── interfaces/
    │   ├── api/                  Domain gateways over GQty:
    │   │   ├── MongoApi.ts       Thin facade composing the domain APIs
    │   │   ├── UserApi.ts
    │   │   ├── AssetApi.ts
    │   │   ├── LanguageApi.ts
    │   │   ├── NavigationApi.ts
    │   │   └── SectionApi.ts
    │   ├── gqty/                 Generated GraphQL client (schema + fetcher)
    │   ├── theme/, scss/         Styling
    │   ├── public/               Static assets + translations (images served via /api/<name>)
    │   └── pages/api/…
    ├── constants/, enums/, helpers/, utils/   Shared non-domain code (incl. sanitize.ts)
    └── Server/certificates/     Server-side TLS certs
```

## Runtime topology

Two processes can serve the GraphQL schema:

1. **`src/frontend/pages/api/graphql.ts`** — Apollo Server embedded in Next. Shares a single `MongoDBConnection` via `getMongoConnection()`. This is what NextAuth, the frontend, and GQty talk to by default.
2. **`src/Server/index.ts`** — Standalone Express + `express-graphql`, started via `npm run standalone-graphql[-docker]`. Same schema + same singleton, used as the server image in the Docker compose stack.

The Next frontend reaches the GraphQL endpoint through the generated GQty client at [src/frontend/gqty/index.ts](src/frontend/gqty/index.ts). The host URL is derived from `BUILD_PORT`:

- Local dev: `http://localhost:80/api/graphql`
- Docker: `http://server:3000/api/graphql` (the standalone server container)

## Data model (from [schema.graphql](src/Server/schema.graphql))

- **Navigation** (`page`, `seo`, ordered `sections[]`) — the site map
- **Section** (`page`, `type`, `content[]`) — a chunk of a page
- **Item** (`type`, `style`, `content`, plus optional `action*` fields) — one cell within a section
- **Image**, **Logo** — media assets
- **User** — `{id, name, email, password, role, avatar}`
- **Language** — `{label, symbol, default}` with a JSON `translations` blob

Mongo collections: `Navigation`, `Sections`, `Images`, `Logos`, `Users`, `Languages`, `Entities`.

## Authentication flow

1. User hits `/api/auth/signin` → NextAuth page.
2. `CredentialsProvider.authorize` in [[...nextauth].ts](src/frontend/pages/api/auth/[...nextauth].ts) calls `mongoApi.getUser({email})` through GQty → GraphQL `mongo.getUser` → `UserService.getUser`.
3. `bcrypt.compare(submittedPassword, user.password)` — stored hash is precomputed.
4. JWT session (`strategy: "jwt"`), with `id/name/email` copied into the token in the `jwt` callback and re-exposed in `session`.

`GoogleProvider` is only registered when both `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` env vars are set — earlier the provider was unconditionally registered with empty strings, which broke the entire `/api/auth/*` handler (Credentials login included) whenever the Google keys were absent.

### Seeded admin

`UserService.setupAdmin()` inserts an admin iff no user with `name: 'Admin'` exists. Seeding is **not automatic** — it happens only when the GraphQL `mongo.setupAdmin` query is executed.

Default admin (see [mongoDBConnection.ts:27-29](src/Server/mongoDBConnection.ts:27)):

| Field    | Value                                                         |
|----------|---------------------------------------------------------------|
| email    | `admin@admin.com`                                             |
| password | `b[ua25cJW2PF` (bcrypt hash stored, `$2b$10$M57z…`)           |

> ⚠️ The plaintext admin password and a MongoDB Atlas connection string with real credentials are checked into [mongoConfig.ts](src/Server/mongoConfig.ts). Rotate these and move them to environment variables.

## Page rendering

- [src/frontend/pages/[...slug].tsx](src/frontend/pages/[...slug].tsx) matches any path and delegates to `App` ([pages/app.tsx](src/frontend/pages/app.tsx)).
- `App` fetches the navigation collection via GraphQL, builds an Ant Design `Tabs` of pages, and renders each page as `DynamicTabsContent` → iterates its section components.
- Per-page SEO (`description`, `keywords`, `viewport`, `charSet`, `url`, `image`, etc.) is projected into `<Head>` as `og:*` meta tags.
- Language picker switches to `/{lang}{currentPath}` via `window.location`.

## Admin panel

- [pages/admin.tsx](src/frontend/pages/admin.tsx) and [pages/admin/settings.tsx](src/frontend/pages/admin/settings.tsx) — require login.
- [components/Admin/AdminApp.tsx](src/frontend/components/Admin/AdminApp.tsx) — same content shell as the public site but with edit wrappers.
- [components/Admin/ConfigComponents/](src/frontend/components/Admin/ConfigComponents/) — per-section-type editors (`InputCarousel`, `InputGallery`, `InputPlainImage`, `InputPlainText`, `InputRichText`).
- [components/common/Dialogs/](src/frontend/components/common/Dialogs/) — modals for adding/editing navigation entries, sections, section items, logos, preview.
- [AdminSettings/](src/frontend/components/Admin/AdminSettings/) — `Languages`, `Users`, `Theme`, `ContentLoader`.

## Scripts ([package.json](package.json))

| Script | Purpose |
|---|---|
| `dev` | `next dev --turbo -p 80 src/frontend` |
| `build` | Production Next build |
| `build-docker` | Production build with `BUILD_PORT=3000` |
| `start` / `start-docker` | Production run on port 80 |
| `postbuild` | `next-sitemap` generation |
| `dev-server` | Nodemon-watched standalone GraphQL |
| `standalone-graphql` | Run [Server/index.ts](src/Server/index.ts) directly via `tsx` |
| `standalone-graphql-docker` | Same, with container-internal port 3000 |
| `ssl` | Run HTTPS variant (`sslServer.ts`) |
| `generate-schema` | Regenerate GQty client from a running GraphQL endpoint |
| `lint` | ESLint with `--fix` |
| `clean` | Remove `.next` cache |

## Docker

[compose.yaml](compose.yaml) wires three services on three networks (`db`, `back-end`, `front-end`):

- **mongodb** (mongo:7.0) — no auth configured on the container, but the code speaks to `mongodb://mongodb:27017` inside Docker or `localhost:27017` outside.
- **server** — standalone GraphQL on port 3000; healthchecked via `?query={sample}`.
- **app** — Next app on port 80; depends on `server` being healthy.

The app container uses `BUILD_PORT=3000` so the GQty fetcher resolves `http://server:3000/api/graphql`.

## Bundle export/import

Entire site (navigation, sections, languages, logo, images metadata, + referenced local image binaries as base64) is a single JSON file. See [BundleService.ts](src/Server/BundleService.ts).

- `GET /api/export` → `site-YYYY-MM-DD.json` download. Only locally-served images (`api/<name>`) are inlined; third-party URLs stay as URLs.
- `POST /api/import` accepts a bundle JSON; validates manifest version, shape, per-asset filename allowlist (`^[\w.\-]+\.(jpg|jpeg|png|gif|webp|svg)$`), and size cap (25 MB / asset). Wipes + restores collections; writes assets to `src/frontend/public/images/` after a `path.resolve()` containment check. Returns `{restored, assets, skippedAssets[]}`.
- Admin UI: Settings → Bundle tab with Download button + file picker + danger-confirmed Apply.

## Content safeguards

- **Error boundary per section** — [SectionErrorBoundary](src/frontend/components/common/SectionErrorBoundary.tsx) isolates render failures; one malformed section no longer blanks the whole page.
- **HTML sanitization** — [sanitizeHtml](src/utils/sanitize.ts) is applied to `RichText` before `innerHTML` assignment. Strips `<script>`/`<iframe>`/`<style>` tags, inline event handlers, and `javascript:`/`data:`/`vbscript:` URLs on `href`/`src`/`action`. Upgrade path: DOMPurify.
- **Bundle import validation** — see above.
- **Defensive parsing** — translation utils guard against non-string content (`typeof html !== 'string'`); `MongoApi.getLogo` returns a safe empty shape when null.

## Notable issues / smells (remaining)

1. **Stale README** — still the default Create React App template despite being a Next.js project.
2. **Duplicated GraphQL surface** — Apollo (Next route) and `express-graphql` (standalone) both serve the same schema; keep in sync or consolidate.
3. **Duplicated editor stacks** — both `draft-js` + `react-draft-wysiwyg` and `ckeditor5` are dependencies; `0d1ee9e` commit suggests the CK migration is mid-flight.
4. **Hardcoded secrets** — [mongoConfig.ts:37-42](src/Server/mongoConfig.ts:37): admin password, Mongo Atlas username/password, cluster URL. Move to env.
5. **Redis all but unused** — only `getBar`. Either wire it into caching/session storage or remove to simplify the stack (and the repo name).
6. **CRA-era polyfills** (`crypto-browserify`, `node-polyfill-webpack-plugin`, `buffer`, `util`, `url`) — likely inherited from CRA origins; audit whether Next actually needs them.
7. **`[...slug].tsx` + `app.tsx`** — `app.tsx` doubles as both an internal page and the shell re-exported into `Slug`. Cleaner to have a layout + page split.
8. **Manual GQty client patches** — `schema.generated.ts` has hand edits (`getLogo` nullability, `createDatabase` removal). Re-run `npm run generate-schema` against a live endpoint to regenerate cleanly.

## Resolved (since initial analysis)

- ~~Per-request Mongo clients~~ — now a singleton via `getMongoConnection()`.
- ~~`UserService.setupAdmin` returns null on first insert~~ — now returns the newly created document.
- ~~Uncommitted service split~~ — services landed + extended with `BundleService`, typecheck-clean.
- ~~Missing auto-seed~~ — `setupAdmin()` auto-runs on first successful Mongo connect + `/api/setup` endpoint.

## Suggested next steps

See [ROADMAP.md](ROADMAP.md) for the full feature plan — Users CRUD, roles/permissions, theme switcher, menu rearrangement, translations UX, 2026 admin overhaul, content-safeguards phase 2, and test coverage.
