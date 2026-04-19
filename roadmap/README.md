# Roadmap plans

One markdown per roadmap item. Each file has the same shape:

- **Goal** — what shipping this means
- **Design** — approach, decisions, data model touches
- **Files to touch** — approximate surface
- **Acceptance** — how we know it's done
- **Effort** — rough time budget (see legend)

The headline [ROADMAP.md](../ROADMAP.md) stays as the short bullet list; these files are the "open this before you start" expansions.

## Effort legend

| Size | Budget | Reality |
|------|--------|---------|
| XS   | < 1 h  | Trivial edit, single file |
| S    | 1–3 h  | Focused change, maybe 1 test |
| M    | 0.5–1 day | Cross-file, needs a quick design call with yourself |
| L    | 1–3 days | New surface, migration, or UX polish loop |
| XL   | 1+ weeks | Architectural — break down further before starting |

Estimates assume one focused engineer already familiar with the codebase. Double for context-switching / review loops.

## Index

### Production / ops — deferred

Tracked separately under [production/](production/) so the two streams can be scheduled independently. See [production/README.md](production/README.md) for the full ordering.

| # | Item | Status |
|---|------|--------|
| P1 | [production/first-boot-admin-password.md](production/first-boot-admin-password.md) | **Shipped** |
| P2 | [production/automatic-deployment.md](production/automatic-deployment.md) | Planned |
| P3 | [production/digitalocean-domain-wiring.md](production/digitalocean-domain-wiring.md) | Planned |

### Feature / UX queue

| # | Item | Size | Notes |
|---|------|------|-------|
| 1 | [admin-ui-language-decouple.md](admin-ui-language-decouple.md) | M–L | Held by owner — do not start |
| 2 | [translations-context-field.md](translations-context-field.md) | S–M | **Shipped** — `translationMeta` map + Compare-view MetaCell |
| 3 | [translations-inline-editing.md](translations-inline-editing.md) | L | Biggest UX lever for translation work |
| 4 | [theme-picker-previews.md](theme-picker-previews.md) | M | **Shipped** — `ThemePreviewFrame` mini-page in cards |
| 5 | [dnd-phase-2.md](dnd-phase-2.md) | L | **Library swap shipped** + intra-section pilot (`SortableList` in `InputList`); rollout to other configs + image rail deferred |
| 6 | [high-contrast-theme.md](high-contrast-theme.md) | M | **Shipped (v1)** — preset + SCSS; auto-pick via prefers-contrast deferred |
| 7 | [icon-consolidation.md](icon-consolidation.md) | L | **Shipped** — Phase 1 (`styled-icons` drop + lint) + Phase 2 (AntD→lucide adapter across 36 files + lint lock) |
| 8 | [audit-log-ui-next.md](audit-log-ui-next.md) | M | Optional — only if inline stamps prove insufficient |
| 9 | [tests-remaining.md](tests-remaining.md) | L | **Partial** — MongoApi facade + conflict + googleFonts tests shipped. LoginBtn / section snapshots / API integration still queued |
| 10 | [google-fonts-picker.md](google-fonts-picker.md) | M | **Shipped v1** — curated 58-family picker, dynamic `<link>` per active theme |
| 11 | [architecture-docs-page.md](architecture-docs-page.md) | M | **Shipped (v1)** — `docs/architecture/` with index + 4 new docs; in-app renderer deferred |
| 12 | [multi-admin-conflict-mitigation.md](multi-admin-conflict-mitigation.md) | L | **Layer 1 shipped + rolled out to Section / Theme / Post / Footer**. SiteFlags/SiteSeo/TranslationMeta/Logo/Language editors still pending. Layers 2/3 deferred |

### Debt

| # | Item | Size | Notes |
|---|------|------|-------|
| 11 | [debt-gqty-regenerate.md](debt-gqty-regenerate.md) | S–M | Depends on stable endpoint being up |
| 12 | [debt-sanitize-key-v2.md](debt-sanitize-key-v2.md) | M | Migration script + behaviour tests |
| 13 | [debt-ghost-navigation-cleanup.md](debt-ghost-navigation-cleanup.md) | XS | Run existing script with `--apply` |
| 14 | [debt-drop-react-drag-reorder.md](debt-drop-react-drag-reorder.md) | XS | **Shipped** — dep removed |

## Total rough budget

- Queued (non-held): ~16–24 engineering days after the 5 new items were added
- Debt: ~1–2 days
- Grand total: ~4–5 focused weeks for everything on this list

### Specific deferrals from the partials above

These four sub-items are repeatedly mentioned as "still pending" inside the partial-shipped roadmap files; tracking them centrally so they don't get lost in the per-item docs.

| Sub-item | Parent roadmap item | Sketch budget |
|---|---|---|
| Conflict UI for SiteFlags / SiteSeo / TranslationMeta / Logo / Language editors | [multi-admin-conflict-mitigation.md](multi-admin-conflict-mitigation.md) | ~30 min × 5 editors = ~2.5 h |
| LoginBtn render test + per-section-type snapshots + API integration tests | [tests-remaining.md](tests-remaining.md) | ~10 h |
| Intra-section drag rollout to the other 7 array-backed configs | [dnd-phase-2.md](dnd-phase-2.md) | ~10 min × 7 = ~1.5 h |
| Image side panel for DnD phase 2 (`useDraggable` thumbnails → gallery / image modules) | [dnd-phase-2.md](dnd-phase-2.md) | ~3–4 h (rail UI + per-module drop targets) |

### Dependency cleanup (`npm install` is now `--legacy-peer-deps`-free)

Dropped unused packages whose pinned peer ranges blocked clean installs: `@react-buddy/ide-toolbox-next`, `react-glidejs`, `react-scripts`, `@svgr/webpack`, `cra-template-typescript`, `uppload-react`, `draftjs-to-html`, `html-to-draftjs`, `@types/draftjs-to-html`, `@types/html-to-draftjs`. Migrated [src/Server/index.ts](../src/Server/index.ts) off the deprecated `express-graphql` to `graphql-http` (already a dep) so we can ship `graphql@16`; dropped `express-graphql` + `graphql-tools` + `graphql-playground-middleware-express`. Pinned `micro` to `^9.4.1` to satisfy `apollo-server-micro@3`'s peer (we never imported `micro` directly). All within-caret deps refreshed via `npm update`.

### Suggested ordering — non-production only

Production items are deferred to [production/](production/) — see that README for when to pick them up.

1. ~~[debt-drop-react-drag-reorder.md](debt-drop-react-drag-reorder.md)~~ — **shipped**
2. ~~[translations-context-field.md](translations-context-field.md)~~ — **shipped**
3. ~~[theme-picker-previews.md](theme-picker-previews.md)~~ — **shipped**
4. ~~[google-fonts-picker.md](google-fonts-picker.md)~~ — **shipped v1** (refresh script + self-hosted variant deferred)
5. ~~[high-contrast-theme.md](high-contrast-theme.md)~~ — **shipped (v1)** (auto-pick deferred)
6. [translations-inline-editing.md](translations-inline-editing.md) — biggest translation UX lever
7. ~~[multi-admin-conflict-mitigation.md](multi-admin-conflict-mitigation.md) Layer 1~~ — **shipped** (Layers 2/3 deferred)
8. ~~[architecture-docs-page.md](architecture-docs-page.md)~~ — **shipped (v1)** (in-app `/admin/help` deferred)
9. ~~[icon-consolidation.md](icon-consolidation.md)~~ — **shipped** (Phase 1 + Phase 2)
10. [dnd-phase-2.md](dnd-phase-2.md) — **library swap shipped** (touch + auto-scroll + keyboard); intra-section items + image rail still pending
11. [audit-log-ui-next.md](audit-log-ui-next.md) — only if inline stamps prove insufficient
12. [tests-remaining.md](tests-remaining.md) — can run in parallel with other work
