# Production caching + static-asset strategy

## Goal

Formalise the caching story across Caddy, Next.js and the admin save path so
that public pages are fast by default, admin edits appear immediately, and
there's a single documented answer to "where does this response come from?"

Context: a critical hotfix landed on 2026-04-23 that moved `/design-v2/*` and
`/images/*` serving out of the Next app and into Caddy's `file_server` (see
current [Caddyfile](../Caddyfile)). That fix works but it's half a strategy —
the app still renders every public page on every request, the section bundles
have no HTTP caching, and there's no invalidation contract when an admin saves.

## Design

### Three tiers, clearly separated

| Tier | Served by | Invalidation |
|------|-----------|--------------|
| Immutable build assets (`_next/static/*`, hashed bundles) | Caddy, `immutable max-age=31536000` | Filename hash — never |
| User uploads (`/design-v2/*`, `/images/*`) | Caddy `file_server` | Content-addressed filenames on upload; bust via rename |
| Dynamic pages + admin + API | Next.js / Node app | See "Page caching" below |

### Page caching

- **Public pages** (`/[...slug]`, `/`, section routes): ISR with
  `revalidate: 60` (one-minute grace) + on-demand revalidation (`res.revalidate(path)`)
  triggered by the admin save endpoint. Today there's zero ISR; every hit
  re-renders.
- **Admin pages** (`/admin/*`): `Cache-Control: no-store`. No change in
  behaviour; just make the header explicit so any intermediate cache respects it.
- **GraphQL endpoint** (`/api/graphql`): `no-store`. Add a short per-process
  DataLoader layer for the same-request fan-out (already a tidy win; current
  code issues redundant Mongo queries on section-heavy pages).

### Upload → revalidate contract

When an admin saves a section / page:

1. Server writes to Mongo.
2. Server calls `res.revalidate('/', ...affectedPaths)` — triggers Next ISR
   regeneration of just the touched pages.
3. Admin UI shows a toast "Published — live in a few seconds" so there's no
   ambiguity.

For uploaded images: filename already collision-suffixed (once
[bulk-image-upload-with-ratio.md](bulk-image-upload-with-ratio.md) lands),
so browsers never see a stale `src` — the URL changes when the content changes.

### Caddy config hardening

- Keep `@uploads` matcher for `/design-v2/*` and `/images/*`
- Lower public-image `max-age` from current 300 s to 60 s **but** add a
  `stale-while-revalidate=604800` so clients keep rendering while Caddy
  re-reads — imperceptible staleness post-edit, no origin hammering.
- Add `zstd gzip` encoding (if not already active) for HTML + JSON responses
  proxied through.
- Access log → file with rotation; today nothing is captured for
  debugging "why is this response slow?" questions.

### What we explicitly do NOT cache

- `/api/graphql` (always live)
- `/api/presence` (live)
- `/locales/*/*.json` (already `no-store` — admin rewrites these)
- Anything under `/admin/*`

## Files to touch

- `Caddyfile` — `zstd gzip`, access log, SWR header, immutable for `/_next/static`
- `ui/client/pages/[...slug].tsx` — `getStaticProps` returns `revalidate: 60`
- `ui/client/pages/index.tsx` — same
- `ui/client/pages/api/admin/save*.ts` (every save endpoint) — call
  `res.revalidate()` for affected paths
- `services/DataLoader.ts` — new; request-scoped batching for Mongo fetches
- `ui/client/pages/api/graphql.ts` — wire DataLoader into context
- `compose.yaml` — mount a log volume for Caddy
- `docs/ARCHITECTURE.md` (or `PROJECT_ANALYSIS.md`) — document the three tiers

## Acceptance

- Public homepage renders from ISR cache under load test (`autocannon -c 50
  -d 30`); p95 < 80 ms at the origin
- Editing a section in admin → public page reflects within 2–3 s of Save
- `/design-v2/*.jpg` returns `Cache-Control: public, max-age=60,
  stale-while-revalidate=604800` and `ETag`
- `/_next/static/**` returns `immutable max-age=31536000`
- GraphQL request fan-out on a section-heavy page drops from N queries to
  1–2 via DataLoader (measure with Mongo profiler)
- Caddy access log captures method, path, status, duration, upstream

## Depends on / pairs with

- [image-optimization-on-upload.md](image-optimization-on-upload.md) — smaller
  files, caching benefits compound.

## Risks

- On-demand revalidation requires Next.js server (not static export) — already
  our setup, just noting.
- ISR + Mongo eventual-consistency: if two admins save within the revalidate
  window, second save's regeneration wins. Acceptable; document.

## Effort

**L** — 1–2 days. ISR wiring + DataLoader + Caddy tweaks + documentation.
Biggest risk is finding every admin save path to add `res.revalidate()` calls;
grep for `collection(...).updateOne` in `pages/api/admin/**` to enumerate.
