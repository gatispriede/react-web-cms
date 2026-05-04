# Fun facts

Lightweight stats about the codebase. Re-run the snippets at the bottom whenever you want a fresh snapshot.

## Codebase composition (2026-05-03)

**~1,658 files** in the working tree, excluding `node_modules/`, `.next/`, `.git/`, generated GraphQL client, package locks, mongo / uploads / var dirs, and IDE configs.

Breakdown by what matters:

| Type | Count | What it is |
|---|---|---|
| TypeScript (`.ts` + `.tsx`) | **803** | The actual code — `services/`, `ui/`, `shared/`, `tests/`, `tools/`, `scripts/` |
| Images (`.jpg` + `.png` + `.jpeg` + `.svg`) | 479 | Mostly in `public/` (CMS content + dev temp) |
| Markdown (`.md`) | 140 | Roadmap, runbooks, site docs, READMEs |
| HTML | 47 | Mostly `public/blog-drafts/` |
| SCSS | 51 | Component styles |
| JSON | 54 | Configs, fixtures, translation seeds |
| JS configs | 27 | `.js` + `.cjs` + `.mjs` (Next / ESLint / vitest configs) |
| Shell + Python | 15 | `tools/` + `scripts/` |

**Real source code ≈ 900 files** (TS/TSX + SCSS + JS configs). The rest is content (images/markdown/HTML) and configs.

## 2026-05-03 — single-day blitz

The day F1 sub-pages + F2 data integrity + AUI simplified + EL-feat-rest + everything else landed (F3 `/v1/**` namespace was attempted and cancelled the same day — see [v1-url-namespace.md](../roadmap/v1-url-namespace.md) postmortem):

- **+50 new files** (services, admin panes, tests, runbooks, fixtures, roadmap docs)
- **644 → 685 tests** (+41 passing, no regressions)
- **133 files changed** in commit `d8dd2ec` alone (+7,714 / -591 lines)
- **30 admin mutations** grant-gated across every editable surface
- **18 SCSS scoping violations** flagged across 9 files (F4 audit)
- **0 critical decisions** that blocked forward motion past the questionnaires

## How to refresh these stats

```bash
# Total files (sans node_modules / .next / .git / generated / locks / runtime data)
find . -type f \
  -not -path './node_modules/*' \
  -not -path './.git/*' \
  -not -path '*/.next/*' \
  -not -path '*/.next-e2e/*' \
  -not -path './services/api/generated/*' \
  -not -path './data/*' -not -path './mongo_data/*' -not -path './var/*' \
  -not -path './uploads/*' -not -path './test-results/*' \
  -not -path './.idea/*' -not -path './.claude/*' \
  -not -name 'package-lock.json' -not -name 'yarn.lock' -not -name '*.tsbuildinfo' \
  | wc -l

# Group by extension
find . -type f [...same exclusions...] | awk -F. '{print $NF}' | sort | uniq -c | sort -rn | head -20

# Live test count
npx vitest run --reporter=dot 2>&1 | tail -3
```
