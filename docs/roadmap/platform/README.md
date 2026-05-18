# Platform — active items

Infra, MCP, migrations, tooling.

## Active items

| Item | Wave | Size | Status |
|---|---|---|---|
| [app-router-migration.md](app-router-migration.md) | 2 | XL (multi-batch) | Batch 1 shipped (App Router foundation + privacy/terms leaf pages). Remaining: B2 mongo re-entry guard + revalidate fix · B3 public shell + index + robots · B4 dynamic public routes · B5 commerce + account routes · B6 auth + admin · B7 cleanup + cutover. |
| ~~[mcp-real-world-ready.md](mcp-real-world-ready.md)~~ | 2 | S | **SHIPPED 2026-05-16.** F8-stream + MCP e2e suite green on Linux CI and Windows local dev. `adminStorageState` fixture pre-warms `/admin/signin` via plain fetch before opening a browser context — cold per-route compile (60–180 s on Windows) no longer races the fixture's own timeout. |
| [backup-and-disaster-recovery.md](backup-and-disaster-recovery.md) | 8 | S (operator-action) | Restic + B2 code shipped. **Operator: B2 bucket + append-only application key + restic passphrase + first `restic init` + GitHub Actions drill workflow.** Runbook `docs/runbooks/backup-and-restore.md`. |
| [terraform-kamal-migration.md](terraform-kamal-migration.md) | — | M (operator-coordinated) | Funisimo cutover shipped 2026-05-08. **Remaining: Skyclimber droplet cutover.** |

## Shipped — see [../shipped.md](../shipped.md)

Recent platform ships:
- Phase 0 shared abstractions: `ISection.locked`, `IPage.source`+`systemKey`+depth-cap-lift+`SystemPageRegistry`, `ISiteFlags` sub-records + `defineFlag()`
- F6 site-mode toggle
- F8-bulk-introspection + F8-stream (`notifications/progress`)
- mcp-rollout-aftermath (every in-scope issue closed)
- link-target-autosearch + anchor registry
- mobile-column-behavior
- testid-coverage CI
- W8d performance budget CI (Lighthouse / size-limit / RUM beacons)
- auth-split-client-admin (two NextAuth instances + master flag)
- TS error burn-down (107 → 0 across services + ui/client)

## Background / context (reference only)

| File | What it is |
|---|---|
| [data-integrity.md](data-integrity.md) | F2 idempotency + cascade engine — reference |
| [slug-source-of-truth.md](slug-source-of-truth.md) | F7 — reference |
| [sub-pages.md](sub-pages.md) | F1 sub-pages — reference |
| [themes-as-files.md](themes-as-files.md) | Shipped 2026-04-24 — reference for first-class-themes |
| [v1-url-namespace.md](v1-url-namespace.md) | F3 cancelled — postmortem |
| [production-caching.md](production-caching.md) | C9 caching design — reference |
| [production-caching-tier1-progress.md](production-caching-tier1-progress.md) | Progress notes |
| [scss-audit-2026-05-03.md](scss-audit-2026-05-03.md) | Reference |
| [scss-scoping.md](scss-scoping.md) | Reference |
| [tests-remaining.md](tests-remaining.md) | Test backlog (mostly closed) |
| [post-refactor-path-cleanup.md](post-refactor-path-cleanup.md) | Reorg follow-up |
| [site-mode-toggle.md](site-mode-toggle.md) | F6 — shipped; reference |
| [mcp-bulk-and-introspection.md](mcp-bulk-and-introspection.md) | F8-bulk — shipped; reference |
| [mcp-rollout-aftermath.md](mcp-rollout-aftermath.md) | Shipped; reference |
| [link-target-autosearch.md](link-target-autosearch.md) | Shipped; reference |
| [mobile-column-behavior.md](mobile-column-behavior.md) | Shipped; reference |
| [performance-budget-ci.md](performance-budget-ci.md) | W8d — shipped; reference |
| [testid-coverage-ci.md](testid-coverage-ci.md) | Shipped; reference |
| [auth-split-client-admin.md](auth-split-client-admin.md) | Phase 1.A — shipped; reference |

Cross-references:
- Runbooks: [../../runbooks/](../../runbooks/)
- Standards: [../_meta/project-standards-additions-2026-05-12.md](../_meta/project-standards-additions-2026-05-12.md)
