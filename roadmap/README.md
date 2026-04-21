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
| P4 | [production/seamless-deployment.md](production/seamless-deployment.md) | Planned |
| P5 | [production/mongodb-auth.md](production/mongodb-auth.md) | Planned |

### Feature / UX queue

| # | Item | Size | Notes |
|---|------|------|-------|
| N15 | [folder-structure-reorg.md](folder-structure-reorg.md) | XL | Maintenance-oriented reorg; awaits user guidelines before starting |
| 9 | [tests-remaining.md](tests-remaining.md) | L | **Partial** — MongoApi facade + conflict + googleFonts tests shipped. LoginBtn / section snapshots / API integration still queued |

### Suggested ordering

1. [tests-remaining.md](tests-remaining.md) — can run in parallel with any of the above
2. [folder-structure-reorg.md](folder-structure-reorg.md) — last, after guidelines agreed

## Total rough budget

- Queued (non-held): ~10–15 engineering days
- Grand total: ~2–3 focused weeks for everything on this list
