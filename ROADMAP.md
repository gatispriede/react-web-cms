# Roadmap — redis-node-js-cloud CMS

Forward-looking only. For the current architecture see [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) and the UML at [public/data-model.svg](src/frontend/public/data-model.svg). Completed work lives in git history.

Per-item implementation plans + time estimates live under [`roadmap/`](roadmap/). Start with [`roadmap/README.md`](roadmap/README.md) for the index.

---

## Queued

### Feature / UX

1. [tests-remaining.md](roadmap/tests-remaining.md) — LoginBtn + session render, per-section-type snapshots, API route integration tests
2. [folder-structure-reorg.md](roadmap/folder-structure-reorg.md) — maintenance-oriented reorg; awaits user guidelines before starting

### Production / ops

Tracked under [`roadmap/production/`](roadmap/production/README.md) so feature/UX and ops can be scheduled independently.

| Item | Status |
|---|---|
| First-boot admin password | **Shipped** |
| [Automatic deployment](roadmap/production/automatic-deployment.md) | Planned |
| [Seamless deployment (zero-downtime)](roadmap/production/seamless-deployment.md) | Planned |
| [DigitalOcean domain + TLS wiring](roadmap/production/digitalocean-domain-wiring.md) | Planned |
| [MongoDB auth](roadmap/production/mongodb-auth.md) | Planned |

---

## Debt

All known debt items have been cleared. See `git log` for the fixes:
- ~~GQty client edits~~ — regenerated cleanly; introspection covers every previously hand-patched field.
- ~~sanitizeKey regex v2~~ — v1 dropped; correct regex + collision-safe hash suffix for long inputs.
- ~~Ghost Navigation docs~~ — root cause fixed; boot-time warning + idempotent cleanup script for legacy databases.
- ~~`react-drag-reorder` dependency~~ — dropped.
- ~~Dead-dep / peer-conflict cleanup~~ — `npm install` runs clean without `--legacy-peer-deps`.
