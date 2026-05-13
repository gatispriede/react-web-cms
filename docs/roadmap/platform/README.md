# Platform track — Waves 2-4

Infra, MCP, caching, migrations, tooling. Everything that's neither admin UX nor public-storefront.

## Active items

| Item | Wave | Size | Status |
|---|---|---|---|
| [testid-coverage-ci.md](testid-coverage-ci.md) | 0d | S | Foundation — AST-walk CI script enforcing `data-testid` on interactive elements |
| [site-mode-toggle.md](site-mode-toggle.md) | 2 (F6) | M | Active — scroll-vs-multipage per-site flag |
| [mcp-bulk-and-introspection.md](mcp-bulk-and-introspection.md) | 2 (F8-bulk) | M | Active — bulk-write + introspection across ~22 MCP tools |
| [mcp-real-world-ready.md](mcp-real-world-ready.md) | 2 | (F8 follow-ups) | Streaming transport + un-skip MCP e2e |
| [mcp-rollout-aftermath.md](mcp-rollout-aftermath.md) | 3 | S | Quick-fix batch for mcp-rollout #1/#5/#9/#11/#12 |
| [link-target-autosearch.md](link-target-autosearch.md) | 2 | M | Active — depends on F6 |
| [mobile-column-behavior.md](mobile-column-behavior.md) | 3 | S | `mobileBehavior` enum + drawer accordion mixin |
| [performance-budget-ci.md](performance-budget-ci.md) | 8 (pre-deploy) | M | Active — Lighthouse CI + Core Web Vitals gates + size-limit + RUM beacons + per-theme PERFORMANCE.md |
| [backup-and-disaster-recovery.md](backup-and-disaster-recovery.md) | 8 (pre-deploy) | L | Active — Restic + B2 backups, weekly automated restore drill, runbook, RPO ≤6h / RTO ≤1h |
| [auth-split-client-admin.md](auth-split-client-admin.md) | (new — post-W6c) | L | Active — split admin auth from customer auth into two NextAuth instances (disjoint cookies + providers + signin pages); add `siteFlags.clientLoginEnabled` master switch + per-provider sub-toggles; auto-mount storefront login surface UI (header dropdown, footer links, login CTA, signup banner) only when flag is on |
| [terraform-kamal-migration.md](terraform-kamal-migration.md) | — | shipped 2026-05-08 (funisimo); Skyclimber pending |

## Background / context

| File | What it is |
|---|---|
| [data-integrity.md](data-integrity.md) | F2 idempotency + cascade engine — shipped, kept as reference |
| [slug-source-of-truth.md](slug-source-of-truth.md) | F7 — shipped, kept as reference |
| [sub-pages.md](sub-pages.md) | F1 sub-pages — shipped, kept as reference |
| [themes-as-files.md](themes-as-files.md) | Shipped 2026-04-24 — kept as reference for first-class-themes |
| [v1-url-namespace.md](v1-url-namespace.md) | F3 cancelled — postmortem |
| [production-caching.md](production-caching.md) | C9 caching design — shipped |
| [production-caching-tier1-progress.md](production-caching-tier1-progress.md) | Shipped progress notes |
| [scss-audit-2026-05-03.md](scss-audit-2026-05-03.md) | Shipped audit — kept as reference |
| [scss-scoping.md](scss-scoping.md) | Shipped scoping rules — kept as reference |
| [tests-remaining.md](tests-remaining.md) | Test backlog (mostly closed) |
| [post-refactor-path-cleanup.md](post-refactor-path-cleanup.md) | Reorg follow-up |
| [app-router-migration.md](app-router-migration.md) | Background reference for any future Next App-Router move |

Cross-references:
- Runbooks: [../../runbooks/](../../runbooks/)
- Standards: [../_meta/project-standards-additions-2026-05-12.md](../_meta/project-standards-additions-2026-05-12.md)
