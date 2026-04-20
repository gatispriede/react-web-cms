# Roadmap — redis-node-js-cloud CMS

Forward-looking only. For the current architecture see [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) and the UML at [public/data-model.svg](src/frontend/public/data-model.svg). Completed work lives in git history.

Per-item implementation plans + time estimates live under [`roadmap/`](roadmap/). Start with [`roadmap/README.md`](roadmap/README.md) for the index.

---

## Queued

### New issue backlog (2026-04-20 — open items only)

Sprint 1 shipped: admin language selector driving the building area, admin URL prefix + translations, hero subtitle/CTA/portrait-label fixes, overlay parity (closed — not a bug), timeline polish, Services + Testimonials + 3 other modules base-style extraction, inline "Same as source" checkbox + Languages table checkbox, space-key bug (dnd-kit `KeyboardSensor` was eating Space on inputs inside sortable sections). See `git log` 2026-04-20 for the diffs.

Remaining:

1. [logo-theme-integration.md](roadmap/logo-theme-integration.md) — logo poorly integrated across themes, especially single-page layout
2. [admin-right-menu-overlap.md](roadmap/admin-right-menu-overlap.md) — right-side admin rail overlays editor content
3. [image-selector-unification.md](roadmap/image-selector-unification.md) — unified image selector/upload across every module
4. [module-style-section-reload.md](roadmap/module-style-section-reload.md) — **partial**: modules ignoring style section + preview not live-reloading (base SCSS fallbacks shipped)
5. [gallery-text-only-mode.md](roadmap/gallery-text-only-mode.md) — text-only gallery without broken-image placeholders
6. [module-selection-dialog.md](roadmap/module-selection-dialog.md) — module selection as dialog/popup rather than inline list
7. [folder-structure-reorg.md](roadmap/folder-structure-reorg.md) — maintenance-oriented reorg; awaits user guidelines before starting
8. [accept-existing-translation.md](roadmap/accept-existing-translation.md) — **partial**: Compare-view polish + hash-based invalidation deferred (inline-editor checkbox shipped)
9. [design-v5-bundle-rework.md](roadmap/design-v5-bundle-rework.md) — **draft scaffold shipped**: `public/design-v5/paper-portfolio-v5.bundle.json` in place as a v1 clone; content rework + v5-specific enhancements pending
10. [public-site-mobile-topbar.md](roadmap/public-site-mobile-topbar.md) — adapt v5's mobile-friendly topbar (logo / nav / language selector) into the live site

### Production / ops (separate stream)
Production deploy, TLS, first-boot secrets, and related ops work live in [`roadmap/production/`](roadmap/production/README.md) so feature/UX and ops can be scheduled independently. Items currently tracked there: first-boot admin password (**shipped**), automatic deployment + first-time server setup, Digital Ocean domain + TLS wiring.

### Tests — remaining
Still queued: `LoginBtn` + session render, per-section-type snapshots, API route integration (`/api/setup` idempotency, `/api/export` + `/api/import` round-trip, `/api/rescan-images` no-op behaviour). See [roadmap/tests-remaining.md](roadmap/tests-remaining.md).

### Architecture docs — in-app renderer
`docs/architecture/` content is shipped. Deferred: in-app `/admin/help` route + Mermaid pipeline (`mermaid` + `remark-react` + `rehype-sanitize` deps), Mermaid sequence + container diagrams, CI reminder script. See [roadmap/architecture-docs-page.md](roadmap/architecture-docs-page.md).

---

## Debt

All known debt items have been cleared. See `git log` for the fixes:
- ~~GQty client edits~~ — regenerated cleanly; introspection covers every previously hand-patched field.
- ~~sanitizeKey regex v2~~ — v1 dropped; correct regex + collision-safe hash suffix for long inputs.
- ~~Ghost Navigation docs~~ — root cause fixed; boot-time warning + idempotent cleanup script for legacy databases.
- ~~`react-drag-reorder` dependency~~ — dropped.
- ~~Dead-dep / peer-conflict cleanup~~ — `npm install` runs clean without `--legacy-peer-deps`.
