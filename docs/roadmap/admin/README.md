# Admin UX — active items

Operator-grade admin polish.

## Active items

| Item | Wave | Size | Status |
|---|---|---|---|
| [admin-content-releases.md](admin-content-releases.md) | 2.5e | XL (~2-3 days AI) | First-class `Release` entity — group N drafts → preview at perspective → publish atomically → rollback. **Note:** Phase 1.D shipped `IPage.source = 'system-page'` + `SystemPageRegistry`; this can build on the locked-section + reset-to-default machinery already in place. |

## Shipped — see [../shipped.md](../shipped.md)

Recent admin ships:
- W0b motion-token-system (Carbon / Material 3 tokens + `--motion-scalar`)
- W0c Sonner toast system (replaced all AntD `message.*`; ESLint guard)
- W0d testid-coverage CI (AST-walk hard gate)
- W1 mobile-friendly-admin (verified pre-shipped — drawer + image rail + PWA manifest + presence)
- W2 admin-dark-mode-audit (global-first token set + `cssVar: true`)
- W2 aui-mode-hierarchy (Themes + Posts on simplified+advanced inheritance)
- W2.5a admin-command-palette (kbar ⌘K + auto-populated actions)
- W2.5b admin-empty-states-onboarding (14 panes + first-run wizard + seeded bundle)
- W2.5c admin-permissions-ux (4-tier + presets + groups)
- W2.5d admin-inline-editing (data-edit-target overlay + drawer editor; 20/24 modules instrumented)
- picker-improvements (admin image picker — info drawer + preview box + sort/filter URL round-trip)
- 20+ admin pane module-compose refactors

## Lower-priority / parked

| Item | Status |
|---|---|
| [admin-info-page.md](admin-info-page.md) | Parked / superseded by Diagnostics pane |
| [admin-menu-icons.md](admin-menu-icons.md) | Parked |
| [admin-modules-preview-page.md](admin-modules-preview-page.md) | Parked — overlaps with shipped inline-editing |
| [drag-drop-images-modules.md](drag-drop-images-modules.md) | Parked — folds into shipped mobile-friendly admin's dnd-kit migration |

Cross-references:
- Standards: [../_meta/project-standards-additions-2026-05-12.md](../_meta/project-standards-additions-2026-05-12.md)
- Research backing: [../_meta/research-findings-2026-05-12.md](../_meta/research-findings-2026-05-12.md) §1 CMS admin UX
- MCP coverage: [../_meta/mcp-coverage-storefront-program.md](../_meta/mcp-coverage-storefront-program.md)
