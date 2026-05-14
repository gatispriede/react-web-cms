# Admin UX track — Waves 0, 1, 2, 2.5

Operator-grade admin polish. Foundational items (motion tokens / Sonner) sit at Wave 0; mobile-friendly admin is Wave 1; AntD dark-mode + AUI hierarchy are Wave 2; the rest of the Admin UX track lives in Wave 2.5.

## Active items

| Item | Wave | Size | Status |
|---|---|---|---|
| [motion-token-system.md](motion-token-system.md) | 0b | S | Foundation — Carbon / Material 3 motion tokens; `--motion-scalar` gates reduced-motion |
| [admin-toast-system-sonner.md](admin-toast-system-sonner.md) | 0c | S | Foundation — Sonner as only toast library; Undo on destructive ops |
| [mobile-friendly-admin.md](mobile-friendly-admin.md) | 1 | L | Active — phone-first admin shell + PWA + drag-reorder a11y |
| [admin-dark-mode-audit.md](admin-dark-mode-audit.md) | 2 | M | Active — enable `cssVar: true` first, then audit 5 admin pages × 2 modes |
| [aui-mode-hierarchy.md](aui-mode-hierarchy.md) | 2 | M | Active — simplified-mode + advanced-mode inheritance pattern |
| [admin-command-palette.md](admin-command-palette.md) | 2.5a | M | Active — ⌘K via kbar; auto-populated from `adminUILoaderRegistry` |
| [admin-empty-states-onboarding.md](admin-empty-states-onboarding.md) | 2.5b | M | Active — 14 designed empty states + first-run wizard + seeded bundle |
| [admin-permissions-ux.md](admin-permissions-ux.md) | 2.5c | L | Active — 4-tier UX + role presets + groups (Notion 3.0 model) |
| [admin-inline-editing.md](admin-inline-editing.md) | 2.5d | L | Active — click-to-edit overlay; `data-edit-target` plumbing |
| [admin-content-releases.md](admin-content-releases.md) | 2.5e | XL | Active — atomic publish groups, preview-at-perspective, rollback |

## Lower-priority / parked

| Item | Status |
|---|---|
| [admin-info-page.md](admin-info-page.md) | Parked / superseded by Diagnostics pane (already shipped) |
| [admin-menu-icons.md](admin-menu-icons.md) | Parked |
| [admin-modules-preview-page.md](admin-modules-preview-page.md) | Parked — overlaps with inline-editing |
| ~~[picker-improvements.md](picker-improvements.md)~~ | **Shipped 2026-05-14** — per-tile info drawer + persistent preview box + sort/filter URL round-trip. See [shipped.md](../shipped.md) |
| [drag-drop-images-modules.md](drag-drop-images-modules.md) | Parked — folds into mobile-friendly admin's dnd-kit migration |

Cross-references:
- Standards: [../_meta/project-standards-additions-2026-05-12.md](../_meta/project-standards-additions-2026-05-12.md)
- Research backing: [../_meta/research-findings-2026-05-12.md](../_meta/research-findings-2026-05-12.md) §1 CMS admin UX
- MCP coverage for admin mutations: [../_meta/mcp-coverage-storefront-program.md](../_meta/mcp-coverage-storefront-program.md)
