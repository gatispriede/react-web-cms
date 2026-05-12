# Roadmap meta — references + standards + catalogues

Non-item docs that the roadmap items reference. **None of these are roadmap items themselves** — they're the source-of-truth references that items cite.

## Contents

| File | What it is |
|---|---|
| [research-findings-2026-05-12.md](research-findings-2026-05-12.md) | Consolidated UX / design-token / marketplace research with citations. Cite, don't re-derive. |
| [project-standards-additions-2026-05-12.md](project-standards-additions-2026-05-12.md) | 14 new project standards (Sonner / kbar / dnd-kit / motion tokens / cssVar / light-dark / WCAG 2.2 AA / 44 px touch / container queries / EmailService.sendTemplated / data-edit-target / 3-layer tokens / jumps-not-iterations / AI-agent-unit estimates). |
| [agent-handoff-format.md](agent-handoff-format.md) | Template + 9 starter-code patterns (A-I) every active roadmap item paste-uses. |
| [mcp-coverage-storefront-program.md](mcp-coverage-storefront-program.md) | Comprehensive MCP tool catalogue for the storefront program. Each tool ships with its parent item; this is the parity gate. |
| [new-modules-catalogue.md](new-modules-catalogue.md) | All ~44 new section / page / cross-theme modules needed for the storefront program. Each module is an independent jump. |
| [target-architecture.md](target-architecture.md) | The shape we're migrating toward — folder/file conventions, import direction rules. |
| [migration-mapping.md](migration-mapping.md) | Old-path → new-path table from the N15 reshape. Useful when chasing stale imports in legacy notes. |
| [folder-structure-reorg.md](folder-structure-reorg.md) | History of the structural moves. Read alongside `target-architecture.md`. |
| [folder-reorg-extensible.html](folder-reorg-extensible.html) | Visual reference for the target tree (open in browser). |

## When to add a file here

Add to `_meta/` if the doc is **referenced by multiple roadmap items** but isn't itself a roadmap item with acceptance criteria + effort. Examples: a new project-wide convention, a new starter-code pattern, a new architecture reference, a new research finding.

If it has its own goal + acceptance + effort estimate, it's a roadmap item — put it in the appropriate track subdir (`storefront/`, `admin/`, `platform/`, `content/`).
