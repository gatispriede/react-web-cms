# Icon consolidation — **Shipped**

**Phase 1: drop dead `styled-icons` dep + lock the door.** Dropped from [`package.json`](../package.json) (top-level + lockfile entry); ESLint `no-restricted-imports` rule errors on any future `from 'styled-icons'` / `'styled-icons/*'` / `'@styled-icons/*'` import.

**Phase 2: `@ant-design/icons` → `lucide-react` migration — done.**

`lucide-react@^0.469.0` added; centralised mapping in [`src/frontend/components/common/icons.tsx`](../src/frontend/components/common/icons.tsx) re-exports lucide icons under their AntD names (`DeleteOutlined`, `PlusOutlined`, …) so the per-call-site diff is one line — only the import path changes. The adapter wraps each lucide icon in an `IconBase` that:

- Forces 16 px (matching AntD's outlined defaults vs. lucide's 24 px)
- Sets stroke-width 1.75 (between AntD's 2-tone density and lucide's 2 px)
- Adds `vertical-align: -0.125em` to baseline-align with surrounding text
- Renders `*Filled` variants with `fill="currentColor"` so the inner area inherits the parent ink colour
- Spins `LoadingOutlined` by default (`spin: true`) via a `@keyframes lucide-spin` injected on first use

Sweep covered all 38 import sites across 36 files (admin chrome, section configs, settings tabs, public-site components, blog post page).

ESLint `no-restricted-imports` rule extended to error on `from '@ant-design/icons'` and `from '@ant-design/icons/*'` so regressions can't sneak back in. `@ant-design/icons` stays in `package.json` because antd itself depends on it internally (`<Input allowClear>`'s X button, `<Spin>` spinner, etc.) — we just stop importing from it in our code.

**Verified:** all 110 tests pass; `/admin` serves 8 lucide-prefixed SVGs at the configured size + stroke; zero `from '@ant-design/icons'` imports remain in `src/frontend/`.

## Goal

One icon set across the app. Today we mix `@ant-design/icons` (bulk) with `styled-icons` (a few places), which bloats the bundle and looks inconsistent.

## Design

- Pick `lucide-react`. Reasons:
  - Consistent stroke weight, works with both editorial and clean themes
  - Tree-shakes cleanly, no per-icon CSS baggage
  - MIT licence, actively maintained
- Map every current icon to its `lucide-react` equivalent. Where antd-specific icons don't have a direct match (`CloudUploadOutlined`, `DeleteOutlined` etc.), pick the closest semantic icon (`Upload`, `Trash2`).
- Build a single mapping table during the migration — keeps the diff reviewable and doubles as docs.

## Files to touch

- Every file that imports from `@ant-design/icons` or `styled-icons` — `grep -rn 'from .@ant-design/icons.' src/frontend` and `grep -rn 'from .styled-icons' src/frontend`
- `package.json` — add `lucide-react`, remove the two old deps (after sweeps land)
- `.eslintrc` or similar — add a `no-restricted-imports` rule for `@ant-design/icons` and `styled-icons` so regressions can't sneak back in

## Migration steps

1. Add `lucide-react`, keep old deps installed
2. Produce the mapping table (one commit)
3. Migrate in logical chunks: admin chrome, then section configs, then public-site components
4. After every import-site is migrated, flip the `no-restricted-imports` lint rule to `error`
5. Remove the old deps, regenerate lockfile

## Acceptance

- `grep -rn '@ant-design/icons\|styled-icons' src/frontend` returns zero results
- Icons render correctly everywhere they used to — spot-check admin + every section type + every theme
- Bundle size report shows a reduction (measure before/after with `next build` output)
- ESLint errors on reintroduction

## Risks / notes

- antd internally uses `@ant-design/icons` for things like `<Input allowClear>`'s X button — that dep stays, we just stop importing from it ourselves
- Some lucide icons render slightly smaller than antd's 16px default — set a consistent size token instead of per-site sizing

## Effort

**L · 1.5–2 engineering days**

- Mapping table: 1–2 h
- Admin chrome migration: 3–4 h
- Section configs + public-site migration: 4–6 h
- Lint rule + final clean-up + bundle measure: 1–2 h
- Visual regression sweep: 2 h
