# Public-site mobile topbar (logo + nav + language) mitigations

**Status:** Partial (2026-04-20).

Shipped in this pass:
- **Section grid collapse (33/33/33 → 100%)**: `.section` now sets `grid-template-columns: repeat(var(--section-cols, N), 1fr)` with the count also exposed as a CSS custom property ([SectionContent.tsx:178](../src/frontend/components/SectionContent.tsx)). Media rule in [`scss/global.scss`](../src/frontend/scss/global.scss) overrides `--section-cols: 1` + forces `grid-column: 1 / -1` on children at `≤ 720 px`. No inline-style `!important` dance — the var trick keeps selectors clean.
- **Content padding**: `.dynamic-content` capped at `16 px` inline padding under 720 px and `12 px` under 460 px (overrides per-theme 28–32 px values with `!important` because `[data-theme-name]` rules out-specify the base).
- **Topbar spacing at mobile**: `.site-tabs > .ant-tabs-nav` gets condensed padding, smaller tab padding, overflow-x scroll on the nav-wrap, logo shrunk to 32 px. Nav labels stay visually distinct instead of squishing into `CAPABILITYMATRIXCAREERRECORD`.
- **Nav labels**: `app.tsx` switched three spots from `t(sanitizeKey(page))` → `translateOrKeep(t, page)`, so untranslated page names now fall back to the original string (`Capability matrix`) instead of the sanitised key (`Capabilitymatrix`).
- **Language selector**: Paper theme's `.language-dropdown` no longer pill-rounded — `border-radius: 0` matches v5's flat editorial look.
- **Hamburger mobile menu**: [MobileNav.tsx](../src/frontend/components/common/MobileNav.tsx) + [scss/Common/MobileNav.scss](../src/frontend/scss/Common/MobileNav.scss) — activates at `≤ 980 px`, hides the horizontal tab/scroll nav, trigger button shows the currently-active page label + caret. Vertical panel lists every page with `01`/`02`/… numeric suffix. Wired into both scroll and tabs layout modes in [pages/app.tsx](../src/frontend/pages/app.tsx).
- **ScrollNav selector fix**: Added `.scroll-nav` class to the ScrollNav wrapper so the mobile media rule can hide it cleanly.
- **Logo mark fallback**: `Logo.tsx` renders `<span class="logo-mark">◆</span>` when no logo is uploaded, so the top-bar left slot always has visible weight. Module-level SCSS in [scss/Common/Logo.scss](../src/frontend/scss/Common/Logo.scss) — bordered square with dashed inset, theme-var-driven colours.
- **Logo absolute-positioning removal**: Old `.logo` rule was `position: absolute; top: 10px; left: 10%` which pulled the element out of flex flow and collided with adjacent items whenever a real logo was uploaded. Now `display: inline-flex` with constrained `img { height: 40px; max-width: 180px }`.
- **Top-bar vertical separators** (Paper theme): dashed hairlines between logo → mobile-nav trigger → language selector, matching design-v5's editorial grid.
- **Section grid collapse (33/33/33 → 100%)**: [SectionContent.tsx](../src/frontend/components/SectionContent.tsx) now exposes `--section-cols` as a custom property; [scss/global.scss](../src/frontend/scss/global.scss) overrides to 1 + forces `grid-column: 1 / -1` on children at `≤ 720 px`.

Still deferred:
- Wordmark + brand refinements at `≤ 460 px` (hide primary name, keep mark only) — matches v5 but low priority.
- Language dropdown pinning to viewport edges on ultra-narrow screens.
- Propagating the vertical-separator treatment into Studio / Industrial / HighContrast themes (currently Paper-only — needs per-theme tuning).

## Context

v5's `Portfolio.html` ships a polished mobile topbar treatment that our live site lacks. The problem exists on the modules themselves, independent of theme/design — logo, public nav links, and language-selector collide / overflow at narrow viewports because the current `site-tabs` layout in [`scss/global.scss`](../src/frontend/scss/global.scss) assumes desktop-width horizontal flex.

Relevant v5 breakpoints and behaviours worth adapting:

- **≤ 980 px** — `topnav` hides; hamburger button appears; `mobile-nav` expands as a collapse panel. Language picker + login stay in the topbar, but condense (lose labels, compress padding).
- **≤ 720 px** — further compression of the wordmark (drop secondary sublabel), language picker caret hidden, login label hidden (icon only).
- **≤ 460 px** — wordmark name hidden (keep mark only), language dropdown pins to viewport edges (`position: fixed; left: 12px; right: 12px`) so it doesn't overflow.
- **≤ 360 px** — extra-narrow safety: tighter gaps, minimum viable padding.

## Design

- Rebuild `.site-tabs` header in the public app layout ([`pages/app.tsx`](../src/frontend/pages/app.tsx)) to match v5's grid: `logo | nav | right-cluster` (status dot + language + login + hamburger), collapsible on narrow viewports.
- Introduce a `MobileNavDrawer` pattern: a collapse region that animates open below the topbar when the hamburger is active. No portal — keep it inline so keyboard focus flows correctly.
- Language selector: reuse the existing `Dropdown` but cap its max-height + `position: fixed` on ≤ 460 px viewports via a scoped class so the dropdown doesn't overflow the viewport.
- Logo: shrink + drop the sub-label text progressively, as v5 demonstrates.

## Files to touch

- `src/frontend/scss/global.scss` — `site-tabs` rules, new `mobile-nav` class tree, `lang-menu` viewport-pinned variant.
- `src/frontend/pages/app.tsx` — render the hamburger button + mobile-nav panel in scroll and tab layout modes.
- `src/frontend/components/common/Logo.tsx` — expose a `compact` prop that trims the sublabel, or drive via CSS `@media` alone.
- New: `src/frontend/components/common/MobileNav.tsx` — small controlled component managing open/closed state and the slide-open animation.

## Acceptance

- On viewport 375 px, nav links are behind a hamburger; language + login still reachable in topbar.
- Language dropdown never overflows the viewport on 360–460 px.
- No JS errors at any width. No layout shift when switching language via the picker.
- Admin chrome unaffected (admin has its own layout).

## Effort

**M · 3–4 h** — mostly SCSS and a small controlled component. Uses v5's HTML as the reference implementation, so patterns are already proven.
