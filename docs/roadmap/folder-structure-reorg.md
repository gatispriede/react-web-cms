# Folder structure reorganisation

**Status:** **Shipped (2026-04-24).** Landed as a single atomic reshape:
`src/frontend/` → `ui/{client,admin}/{modules,features,lib,pages,public,shell,styles,...}/`,
`src/Server/` → `services/{features/<Domain>/,infra/,api/}/`,
types/enums/utils → `shared/`, scripts → `tools/`, ops → `infra/`. Path aliases:
`@client/* @admin/* @services/* @shared/* @interfaces/* @enums/* @utils/*`.
Verification: tsc 0/0 on both projects, 136/136 vitest, dev-server serves `/` + `/admin` as 200.
See [migration-mapping.md](migration-mapping.md) for the full old→new table.

## Goal

Project source is re-organised so that responsibilities are decoupled, modules are self-explanatory, and new contributors can navigate without a map. Maintenance wins (finding things, moving things, deleting things) take priority over current ergonomics.

## Design (to be expanded with user guidelines)

Architectural principles to honour:

- **Decoupled**: UI, domain logic, data access, infra each in their own layer — no cross-imports that skip layers.
- **Modular**: each feature (a module, a settings tab, an admin capability) is a self-contained folder with its components, styles, tests, and schema.
- **Self-explanatory**: folder names describe intent (`sections/hero/`, not `components/A123/`). A newcomer can guess what lives where.
- **Maintenance-first**: reduce file count where practical; colocate related pieces; avoid deep nesting for nesting's sake.

High-level sketches to evaluate:

- `src/frontend/` → split into `app/` (routing), `ui/` (shared components), `features/` (admin + public site features), `lib/` (glue — i18n, theme engine, GraphQL client), `styles/` (global SCSS + tokens only).
- `src/Server/` → split into `routes/`, `services/` (business logic), `infra/` (mongo, auth, logging), `interfaces/` (types).
- Sections (modules) become `features/sections/<name>/` containing `{Section}.tsx`, `{Section}.editor.tsx`, `{Section}.scss`, `schema.ts`, `index.ts`, tests — registry picks them up automatically.

Open questions — resolve with user before moving a file:

- Are admin + public site separate app trees, or shared with capability-gated surfaces?
- Do we keep Next.js app-router structure as the top level, or introduce a `features/` layer that app-router imports from?
- Rename policy: bulk move + git-trackable (`git mv`) vs. incremental per-feature.

## Files to touch

- Virtually every folder under `src/`. Plan to execute in phases to keep diffs reviewable:
  1. Define target tree; land empty structure + README per directory
  2. Migrate shared UI + lib
  3. Migrate one feature end-to-end (sections) as a pilot
  4. Migrate remaining features
  5. Remove old locations, update tsconfig paths, update docs

## Acceptance

- Every folder's purpose is clear from its name
- No cross-layer imports that skip the intended hierarchy
- Moving or deleting a feature touches one folder
- Build + tests green after each phase
- [PROJECT_ANALYSIS.md](../PROJECT_ANALYSIS.md) and architecture docs updated to reflect new tree

## Effort

**XL · 1+ weeks** — break down into phases once user guidelines are confirmed. Do not start this without an agreed phase plan.
