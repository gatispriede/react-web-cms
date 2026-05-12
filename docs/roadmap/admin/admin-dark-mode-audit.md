---
name: admin-dark-mode-audit
description: Screenshot-driven audit of admin light + dark mode across 5 representative pages, run through Stitch for visual diagnosis, fixed globally via AntD ConfigProvider theme tokens first and only then per-feature overrides.
---

# Admin dark-mode audit — global-first, screenshots through Stitch

## Goal

Today's admin dark mode has visible legibility bugs: some text is unreadable on dark backgrounds, some text stays in light-mode colors (didn't switch at all). The pattern is per-feature drift — components written before dark mode was wired, or local SCSS hardcoding `#000` / `#fff` / `rgba(0,0,0,…)` instead of consuming tokens.

Fix it **global-first**: tune the AntD `ConfigProvider` theme tokens (light + dark) so the base palette renders correctly everywhere, then chase the per-feature stragglers that the global pass didn't cover.

Diagnose by screenshotting **5 representative admin pages in both modes**, running them through **Stitch** for side-by-side review + design suggestions, then applying fixes top-down.

## Why now

- Dark mode is a top-bar feature operators see every session; broken contrast is a confidence killer.
- Simplified-mode + dark-mode are both already hoisted to the top-top bar (2026-04-30 → 2026-05-03 blitz). The plumbing is in place — the audit is what's missing.
- Doing it as a global AntD theme pass is cheap; doing it page-by-page is endless. Surface the global wins first.

## Approach — global first, per-feature second

### Step 1 — pick 5 representative pages

Pages with the broadest component coverage so a global fix moves the needle everywhere:

1. **Page editor** (`/admin/pages/[id]`) — section/module editor strip, drag arrows, AntD `Tabs`, `Select`, `Input`, `Modal`
2. **Posts list** (`/admin/posts`) — AntD `Table` + filters + `Tag`s + pagination
3. **Products** (`/admin/products`) — Table + inline-edit + variant editor + Drawer
4. **Themes** (`/admin/themes`) — preset gallery + token editor + color pickers
5. **System / Diagnostics** (`/admin/system/info`) — descriptions list, status badges, code blocks, expandable rows

These five exercise nearly every AntD primitive we use + the heaviest custom SCSS.

### Step 2 — capture screenshots

Each page in **both light + dark**, at desktop width. Captured via the existing e2e visual baseline harness (`tests/e2e/visual/`) for repeatability, not one-off DevTools shots. Save under `docs/audits/admin-dark-mode-2026-05-XX/`.

### Step 3 — Stitch review

Upload the 10 screenshots to Stitch. Per page, ask for:
- Unreadable text (contrast failures — flag anything below WCAG AA 4.5:1 for normal text, 3:1 for large)
- Text/element that didn't switch (still rendering in the wrong mode's palette)
- Inconsistent surface colors (siblings on different elevations rendered identically)
- Token suggestions: which AntD theme token controls each broken area

Output: a punch list per page, grouped by `(token fix vs. SCSS fix vs. component fix)`.

### Step 4 — global fix pass (AntD ConfigProvider)

**Confirmed current state (2026-05-12):** `ui/admin/shell/AdminApp.tsx:243-246` renders `ConfigProvider` with a static `theme.token` (from `ui/client/features/Themes/themeConfig.ts`) + algorithm swap for dark mode. **`cssVar: true` is NOT enabled.** There's a parallel `[data-admin-theme="dark"]` selector approach used by SCSS that's outside the ConfigProvider's reach — that's a major source of the drift we're auditing.

Fix sequence:

1. **Enable `cssVar: true`** on the `ConfigProvider` `theme` prop. This is the load-bearing change — it exposes AntD tokens as CSS custom properties (`var(--ant-color-text)` etc.), which the existing `[data-admin-theme="dark"]` SCSS can then consume instead of hardcoded colors. Without this, the audit is fighting two parallel systems.
2. Where the diagnosis points to a token, fix at the source — extend `token.{colorTextBase, colorBgBase, colorBorder, colorBgContainer, colorBgElevated, colorBgLayout, colorTextSecondary, colorTextTertiary, colorTextQuaternary, colorTextPlaceholder, colorLink, colorLinkHover, colorErrorText, colorWarningText, …}` for **both** `algorithm: theme.defaultAlgorithm` and `algorithm: theme.darkAlgorithm`.
3. Verify every `components.{Table, Tabs, Menu, Modal, Drawer, Form, Select, Input, Tag, …}` override doesn't hardcode a color that breaks one mode. Replace with token references.
4. Migrate SCSS under `[data-admin-theme="dark"]` selectors to consume `var(--ant-color-*)` from the now-enabled CSS vars. The existing dark-theme SCSS layer collapses to "AntD tokens + occasional component-scoped overrides," not a parallel palette.

After this pass, re-screenshot the 5 pages. The delta is the global wins.

### Step 5 — per-feature pass

Only the issues that survived the global fix. Most should fall into:

- A custom component that doesn't consume `useToken()` and inlines a color.
- An SCSS file scoped to one feature with hardcoded hex.
- An image / icon / SVG with hardcoded fill, not `currentColor`.

Fix at the lowest local level. Each per-feature fix should produce a 1-line entry in the audit doc pointing at the file.

### Step 6 — final re-screenshot + commit baselines

After both passes, capture the new visual baselines. These become the dark-mode regression guard.

## Files to touch

- `ui/admin/theme/antdTheme.ts` (or the equivalent `ConfigProvider` config — locate during step 4) — primary global pass
- `ui/admin/styles/**.scss` — replace hardcoded colors with CSS vars
- Per-feature: TBD per Stitch punch list, but expect hits in:
  - Diagnostics descriptions / code blocks
  - Theme editor color pickers
  - Posts/Products table cell formatters
  - Any custom Tag / Badge / Status component
- `tests/e2e/visual/admin-dark-mode.spec.ts` — new spec capturing the 5 pages in both modes (depends on Q4-cap baselines existing)
- `docs/audits/admin-dark-mode-2026-05-XX/` — screenshots + Stitch punch list + remediation notes

## Acceptance

1. Every text element on the 5 audited pages meets WCAG AA contrast in both modes.
2. No element renders in the wrong mode's palette (every color switches when the mode toggles).
3. The global AntD theme covers ≥80% of fixes; per-feature touches are the long tail, not the bulk.
4. `cssVar: true` enabled on `ConfigProvider` (or documented why not).
5. Visual baselines committed for both modes across the 5 pages — future regressions caught in CI.
6. Audit doc at `docs/audits/admin-dark-mode-2026-05-XX/README.md` lists every issue found, where it was fixed, and the file path.

## Effort

**M — ~1 day.**

- Screenshot capture: ~30 min (using existing e2e visual harness)
- Stitch review + punch list: ~1 hr
- Global AntD theme fix pass: ~2-3 hr
- Per-feature stragglers: ~2-3 hr depending on count
- Re-screenshot + baseline commit: ~30 min
- Audit doc write-up: ~30 min

## Dependencies

- **Q4-cap visual baselines** — strongly desired so the screenshots have a home and regression coverage is automatic.
- **AntD `cssVar: true`** — enable as part of step 4 if not already on; allows downstream SCSS to consume tokens.
- Pairs with [first-class-themes.md](../storefront/first-class-themes.md) — the audit is admin-only; first-class-themes covers the public site. Same global-first-then-local discipline.

## Open questions

1. Should dark mode be a **per-user** preference (already?) or **per-site**? If per-site, the screenshot harness needs to flip a site flag, not a user setting. Resolve before step 2.
2. Are there third-party admin widgets (color pickers, rich text, image cropper) that ignore AntD theme entirely? If yes, they're per-feature fixes regardless of how strong the global pass is — flag during Stitch review.
