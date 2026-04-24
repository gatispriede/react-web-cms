# Architecture docs

Single entry point for "how is this CMS built?" — onboarding target is **30 minutes from first read to landing a small change.**

## Reading order

For someone seeing the codebase for the first time:

1. [`overview.md`](overview.md) — what this is, two paragraphs.
2. [`../../PROJECT_ANALYSIS.md`](../../PROJECT_ANALYSIS.md) — comprehensive rundown: tech stack, file layout, runtime topology, data model, rendering modes, admin panel, scripts. Single longest doc, the one to skim first.
3. [`data-model.md`](data-model.md) — collections, relationships, audit + version fields.
4. [`request-lifecycle.md`](request-lifecycle.md) — what happens when a public URL or admin mutation is hit, from browser to Mongo and back.
5. [`auth-roles.md`](auth-roles.md) — viewer / editor / admin gates, NextAuth flow, first-boot admin password, `authz` Proxy.
6. [`publishing.md`](publishing.md) — snapshots, rollback, bundle export/import, draft posts, optimistic-concurrency `version` field.
7. [`../../THEMING.md`](../../THEMING.md) — admin chrome vs. module output, `[data-theme-name]` scoping contract, fonts pipeline, accessibility themes.
8. [`../../DEPLOY.md`](../../DEPLOY.md) — Docker compose stack, env vars, MongoDB seed, boot order.
9. [`admin-systems.md`](admin-systems.md) — admin i18n, inline translation editing, icon system, DnD architecture, Google Fonts proxy.

## At-a-glance index

| Doc | What it covers | Status |
|---|---|---|
| [`overview.md`](overview.md) | Three-paragraph "what is this and what does it do" | New |
| [`data-model.md`](data-model.md) | Collections (incl. AuditLog + Presence), relationships, `editedBy` / `editedAt` / `version` audit triplet | New |
| [`request-lifecycle.md`](request-lifecycle.md) | Public-page render path + admin-mutation path with caching layers | New |
| [`auth-roles.md`](auth-roles.md) | NextAuth, role gating, first-boot admin password, `authz` Proxy | New |
| [`publishing.md`](publishing.md) | Snapshots, rollback, bundle export/import, drafts, version conflicts | New |
| [`module-interfaces.md`](module-interfaces.md) | Content JSON shapes for all 17 item types | New |
| [`admin-systems.md`](admin-systems.md) | Admin i18n, inline translation, icon system, DnD split, Google Fonts proxy | New |
| [`../../PROJECT_ANALYSIS.md`](../../PROJECT_ANALYSIS.md) | Tech stack · file structure · runtime topology · 17 item types · admin panel · 7 themes · scripts | Canonical |
| [`../../THEMING.md`](../../THEMING.md) | Chrome / module split · CSS-var pipeline · scoping contract · fonts · a11y themes | Canonical |
| [`../../DEPLOY.md`](../../DEPLOY.md) | Docker compose · env vars · MongoDB Atlas vs. local | Canonical |

## Feature docs

User-facing features are documented in [`../features/`](../features/). Each file covers what the feature does, how to find the code, and operational notes — without duplicating the technical internals that live here.

The "Canonical" docs stay at the repo root because dozens of other files (`ROADMAP.md`, roadmap items, SCSS file headers) link to them. Moving them would rot every cross-link. Treat this directory as the **front door**; the root files are the **rooms**.

## Diagrams

- [`./data-model.svg`](./data-model.svg) — UML of the Mongo collections.

Sequence + topology diagrams (request lifecycle, deployment containers) are deferred. Until they ship, the textual `request-lifecycle.md` carries the same information in ASCII steps.

## Maintenance

Every PR that meaningfully changes architectural surface — new service, new collection, new mutation, new auth role, new env var, new Docker container — should update the relevant doc in the same commit. There is no CI gate yet; reviewer discretion.

When in doubt: prefer to under-document an internal helper, over-document a boundary (HTTP, Mongo, env vars, runtime modes). The boundaries are what break across versions; helpers can be re-discovered by reading the code.

Last reviewed: 2026-04-19.
