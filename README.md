# CMS (Next.js + MongoDB + GraphQL)

A self-hosted content-management system powering a developer portfolio.
Admin-authored pages composed of registry-driven section blocks
(Hero / ProjectCard / SkillPills / Timeline / SocialLinks / BlogFeed +
Text / RichText / Image / Gallery / Carousel). Full SSG via Next.js
`getStaticProps` + `getStaticPaths` — production pages are pre-rendered
HTML; `next dev` keeps the workflow dynamic.

## Stack

- Next.js 15 (pages router, Turbopack in dev), React 19, TypeScript 5
- Ant Design v5 + custom SCSS + reveal-on-scroll animations; CSS-vars
  theming so modules follow the active theme while admin chrome stays static
- GraphQL via Apollo Server (Next API route) **and** standalone Express
  ([src/Server/index.ts](src/Server/index.ts)); shared resolver map in
  [graphqlResolvers.ts](src/Server/graphqlResolvers.ts), standalone binds
  127.0.0.1 by default
- Method-level authz proxy ([authz.ts](src/Server/authz.ts)) with role gates,
  capability predicates, and session-injection for audit stamping
- MongoDB 7 — `Navigation`, `Sections`, `Users`, `Languages`, `Themes`,
  `SiteSettings` (footer / flags / SEO / active theme), `PublishedSnapshots`,
  `Posts`, `Images`, `Logos`
- NextAuth (Credentials + optional Google), JWT sessions carrying
  `role` + `canPublishProduction`; bcrypt hashing, rate-limited sign-in
- next-i18next — table-based translation editor + side-by-side compare view
  with CSV export/import; merge-on-save preserves untouched keys, disk +
  Mongo kept in sync
- Public layout: classic tabs **or** single-page scroll (site flag)
- Versioned publishing with rollback + per-snapshot audit trail
- Vitest + `mongodb-memory-server` — 110 passing tests, CI on every PR

## Quickstart (local dev)

```bash
# 1. Install deps
yarn --frozen-lockfile

# 2. Copy env template and fill values
cp .env.example .env.local
# At minimum: NEXTAUTH_SECRET, MONGODB_URI, ADMIN_DEFAULT_PASSWORD

# 3. Start MongoDB locally (one of)
docker compose up -d mongodb
# or: systemctl start mongod

# 4. Run the Next dev server
npm run dev            # → http://localhost/admin

# 5. Sign in to the admin
#    email: admin@admin.com
#    password: whatever you set as ADMIN_DEFAULT_PASSWORD
```

Edit content, toggle themes, publish snapshots — all at
`http://localhost/admin`. The public site lives at `http://localhost/lv`.

## Building for production

See [DEPLOY.md](DEPLOY.md) for the full DigitalOcean flow. The short version:

```bash
# On your laptop, with the standalone GraphQL server running on :3000
npm run build              # SSG: bakes current Mongo content into HTML
./Scripts/deploy.sh        # rsync .next + public → droplet, pm2 reload
```

`next build` produces real static HTML for every navigation page and blog
post. ISR (`revalidate: 60`) regenerates individual pages in the background
when admin edits land.

## Project docs

| Doc | What's in it |
|---|---|
| [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) | Architecture, data model, runtime topology |
| [ROADMAP.md](ROADMAP.md) | Feature log + queued work |
| [THEMING.md](THEMING.md) | The admin-chrome / module-output theming boundary |
| [DEPLOY.md](DEPLOY.md) | DigitalOcean droplet setup end-to-end |
| `secrets.md` (gitignored) | Droplet IPs, DB passwords, API tokens |

## Tests

```bash
npm test                   # all
npm run test:watch
npm run test:coverage
```

110 passing tests covering content schemas, DOMPurify sanitizer, authorization
proxy (+ session injection), theme token normalization, per-service integration
(UserService, ThemeService, PublishService, SiteSeoService, NavigationService,
LanguageService, AssetService, BundleService round-trip + hostile fixture,
FooterService, SiteFlagsService), translation extractor, CSV parser, autosave
hook, and the `_origin` / `_rateLimit` API helpers.

GitHub Actions runs typecheck + `npm test` on every PR — see
[.github/workflows/ci.yml](.github/workflows/ci.yml).

## Scripts summary

| Script | Purpose |
|---|---|
| `npm run dev` | Next dev on port 80 (Turbopack) |
| `npm run standalone-graphql` | Standalone GraphQL server on port 80 |
| `npm run build` | Production build (SSG + sitemap) |
| `npm start` | Production serve of `.next/` |
| `npm run generate-schema` | Regenerate the GQty client |
| `./Scripts/deploy.sh` | Local build + rsync + remote reload |

## License

Personal project — reach out before using commercially.
