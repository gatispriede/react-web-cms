# Architecture docs page — **Shipped (v1)**

Consolidated entry point at [`docs/architecture/README.md`](../docs/architecture/README.md). Four net-new docs:

- [`overview.md`](../docs/architecture/overview.md) — three paragraphs of "what is this".
- [`data-model.md`](../docs/architecture/data-model.md) — Mongo collections, `SiteSettings` keyed-singleton pattern, audit triplet (`editedBy` / `editedAt` / `version`), section composition mechanics.
- [`request-lifecycle.md`](../docs/architecture/request-lifecycle.md) — public-page render path + admin-mutation path with caching layers; `_document.tsx` server-side priming for theme + fonts + preloaded data.
- [`auth-roles.md`](../docs/architecture/auth-roles.md) — viewer/editor/admin tiers, NextAuth flow, seeded admin, `authz` Proxy with `METHOD_ROLE_REQUIREMENTS` + `SESSION_INJECTED_METHODS` cheat-sheet, optimistic-concurrency second gate.
- [`publishing.md`](../docs/architecture/publishing.md) — snapshots vs. bundles vs. drafts, audit triplet, conflict semantics around publish/rollback.

Existing [`PROJECT_ANALYSIS.md`](../PROJECT_ANALYSIS.md), [`THEMING.md`](../THEMING.md), [`DEPLOY.md`](../DEPLOY.md) stay at the repo root because dozens of files (`ROADMAP.md`, roadmap items, SCSS file headers) link to them. Index links into both old + new — front door is `docs/architecture/`, the canonical files are the rooms.

**Deferred:**

- In-app `/admin/help` route + `HelpViewer` component (would add `mermaid` + `remark-react` + `rehype-sanitize` deps).
- Mermaid sequence + deployment-topology diagrams (placeholder lives in `request-lifecycle.md` as ASCII).
- CI reminder script that flags `src/Server/` or `src/frontend/pages/api/` PRs without a `docs/architecture/` diff.

## Goal

A single entry point for "how is this CMS built?" — tech stack, file structure, UML, data model, deployment topology — kept **in-repo** and rendered both as markdown on GitHub and as a styled page inside the admin ("Help → Architecture"). Onboarding a new engineer drops from "read the codebase" to "read this page".

## Design

### Source of truth

- Everything lives under `docs/architecture/` as markdown + SVG
- Existing artefacts to fold in:
  - `PROJECT_ANALYSIS.md` → condense into `docs/architecture/overview.md`
  - `THEMING.md` → `docs/architecture/theming.md`
  - `DEPLOY.md` → `docs/architecture/deployment.md`
  - `src/frontend/public/data-model.svg` → `docs/architecture/diagrams/data-model.svg`

### Structure

```
docs/architecture/
  README.md                  # index, reading order
  overview.md                # what this is, 2-3 paragraphs
  tech-stack.md              # Next, Mongo, Redis, GQty, antd, Uppload, vitest
  file-structure.md          # annotated tree of src/, public/, Scripts/
  data-model.md              # collections, relationships, audit shape
  request-lifecycle.md       # SSR → GraphQL → Mongo → back; caching layers
  rendering-pipeline.md      # SSG vs SSR, section composition, themes
  auth-roles.md              # viewer/editor/admin, session cookie, setup flow
  publishing.md              # bundle export/import, rescan disk, draft mode
  deployment.md              # Docker compose, env vars, boot order
  diagrams/
    data-model.svg
    request-lifecycle.svg    # new — sequence diagram
    deployment-topology.svg  # new — container diagram
```

### Diagrams

- UML / C4 via Mermaid in the markdown OR committed SVG
- Prefer Mermaid — renders natively on GitHub and in-app via `mermaid` npm package
- Where Mermaid is too limited (data-model is already dense), keep the SVG and source it from a `.drawio` also in-repo

### In-app surfacing

- New "Help" nav item in admin chrome → route `/admin/help`
- Renders markdown from `docs/architecture/` via `remark-react` + `rehype-sanitize`
- Mermaid blocks render to inline SVG
- Diagrams load as `<img>` from `/docs/architecture/diagrams/…` (static assets from Next `public/`)

### Maintenance

- Every PR that touches architectural surface must update the relevant doc. Add a CODEOWNERS-style CI check: if `src/Server/` or `src/frontend/pages/api/` changes without a corresponding `docs/architecture/` diff, CI prints a reminder (warning, not hard fail).

## Files to touch

- Move/copy existing `PROJECT_ANALYSIS.md`, `THEMING.md`, `DEPLOY.md` into `docs/architecture/` (keep redirect stubs at old paths for external links)
- Create new diagrams for request lifecycle and deployment topology
- `src/frontend/pages/admin/help.tsx` (new) — markdown renderer route
- `src/frontend/components/Admin/HelpViewer.tsx` (new) — the renderer component
- `src/frontend/components/AdminApp.tsx` — add Help nav item
- `package.json` — `remark-react`, `rehype-sanitize`, `mermaid`
- CI script for doc-diff reminder

## Acceptance

- Opening `/admin/help` lists every doc with a 1-line summary and renders them cleanly (markdown + Mermaid + SVG)
- A brand-new engineer can follow `README.md → overview → tech-stack → file-structure` and orient themselves inside 30 min
- Every doc has a "Last reviewed: YYYY-MM-DD" footer stamp
- Diagrams match reality — run `diff` against a fresh `npm run generate-data-model` where applicable

## Risks / notes

- Docs rot. CI reminder helps, but don't make it a blocker — noisy CI breeds `// TODO:` docs
- Keep the in-app renderer sandboxed (`rehype-sanitize`) — you don't want a PR to inject script tags via a doc

## Effort

**M · 1 engineering day (~6–8 h)**

- Folder reorg + existing-doc migration: 1–2 h
- Write net-new docs (request lifecycle, publishing, auth-roles): 2–3 h
- New diagrams (request sequence, deployment topology): 1–2 h
- In-app renderer route: 1–2 h
- CI reminder script: 30 min
