# Roadmap — redis-node-js-cloud CMS

Forward-looking only. For the current architecture see [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) and the UML at [public/data-model.svg](src/frontend/public/data-model.svg). Completed work lives in git history.

Per-item implementation plans + time estimates live under [`roadmap/`](roadmap/). Start with [`roadmap/README.md`](roadmap/README.md) for the index.

---

## Queued

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
