# CMS (Next.js + MongoDB + GraphQL)

A self-hosted content-management system powering a developer portfolio.
Admin-authored pages composed of registry-driven section blocks
(Hero / ProjectCard / SkillPills / Timeline / SocialLinks / BlogFeed +
Text / RichText / Image / Gallery / Carousel). Full SSG via Next.js
`getStaticProps` + `getStaticPaths` — production pages are pre-rendered
HTML; `next dev` keeps the workflow dynamic.

## Stack

- Next.js 15 (pages router, Turbopack in dev), React 19, TypeScript 5
- Ant Design v5 + custom SCSS + reveal-on-scroll animations
- GraphQL via Apollo Server (Next API route) **or** standalone Express
  ([src/Server/index.ts](src/Server/index.ts)) — same schema, same singleton
- MongoDB 7 — `Navigation`, `Sections`, `Users`, `Languages`, `Themes`,
  `SiteSettings`, `PublishedSnapshots`, `Posts`, `Images`, `Logos`
- NextAuth (Credentials + optional Google), JWT sessions carrying
  `role` + `canPublishProduction`
- next-i18next — table-based translation editor with missing-key filter
- Vitest + `mongodb-memory-server` baseline tests

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

27 passing tests covering content schemas, sanitizer, authorization proxy,
theme token normalization, and UserService integration (in-memory Mongo).

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
