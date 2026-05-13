# Agency — first-class theme

**Status:** shipped 2026-05-13. Per-theme baseline pass `tests/e2e/visual/themes/agency.spec.ts` ships alongside.

## Target audience

Design / dev / brand / marketing studios. Team voice. The "expensive portfolio" tier — Vercel / Linear / Sentry portfolio-page energy.

## Mood

Stark · expressive · confident · brutalist-adjacent · scroll-tied.

Translates to:
- **Stark light surface (#F5F5F5) + true black ink + coral accent (#FF5C5C).** No warmth, no soft greys — high contrast, high confidence. The accent reads as alarm-clock urgency.
- **Geist display + body** (Vercel's modern sans, available as a Google Font). Tight tracking, heavy weight on display. Geist Mono for project metadata + case-study captions — mono-as-design-element, not mono-as-code-snippet.
- **Expressive-bold motion.** Springy overshoot eases (`cubic-bezier(0.34, 1.56, 0.64, 1)`), 120px reveal distances. Reveals look like they have weight + physics. Most distinctive motion of the five themes.
- **0px radii everywhere.** Sharp, brutalist-adjacent. No softness; the design is the work.
- **Hide-on-down-show-on-up header** (Headroom / Medium pattern). Most distinctive header behaviour of the five themes.
- **Oversized hero typography** — `clamp(3rem, 12vw, 9rem)` headline; the headline IS the design.
- **Mono labels everywhere** for metadata: breadcrumbs, cadence chips, progress-timeline step labels, VAT badges, metric descriptions.

## When to pick this

- Design / dev / brand studios with case-study-led portfolios.
- Sites where motion + typography are the brand statement.
- Anywhere "this is expensive" is the desired vibe.
- Pairs naturally with the agency/portfolio modules already shipped (ProjectCaseStudy, ProjectTileGrid, BeforeAfterSlider, MetricsCallout, ProcessTimeline, ServicesGridFancy).

## When NOT to pick this

- Individual creators with reading-first portfolios — use `editorial` (warm cream + serif + slow).
- Product shops — use `commerce` (snappy retail, soft 8px radii, emerald CTAs).
- SaaS products — `saas-landing` shares some DNA (dark + oversized) but ships pricing tables + feature grids as the page primitives, not project tiles.
- Restaurant / event / local business — none of the warmth or photo-led aesthetic that those verticals need.

## File layout

| File | Role |
| --- | --- |
| `theme.json` | Canonical manifest. Read by `ThemeRegistry` at boot. |
| `theme.scss` | Semantic-token overrides scoped under `[data-theme-name="agency"]`. |
| `module-styles.scss` | Per-module overrides — Hero (oversized type), case-study (scroll-tied, big-number metrics), tile-grid (asymmetric masonry), BeforeAfterSlider (sharp drag handle), MetricsCallout (signature big-number block), ServicesGridFancy (accent-fill hover), buttons (flat + mono label), all cards (0px radii + hairline + accent-on-hover), footer (brand-led XXL, huge wordmark). Mono-flagged metadata across breadcrumbs / chips / cadence labels. |
| `product-templates.scss` | (legacy slot retained). |
| `README.md` | This file. |

## Tokens

### Palette (light → dark via `light-dark()`)

| Token | Light | Dark |
| --- | --- | --- |
| `--color-surface` | `#F5F5F5` (warm white) | `#0A0A0A` (near black) |
| `--color-ink` | `#000000` (true black) | `#F5F5F5` (warm white) |
| `--color-accent` | `#FF5C5C` (coral) | `#FF5C5C` (coral — kept identical for brand consistency) |
| `--color-accent-ink` | `#FFFFFF` | `#0A0A0A` |
| `--color-surface-inset` | `#EAEAEA` | `#141414` |
| `--color-rule` | `#1A1A1A` (heavy rule) | `#E5E5E5` (heavy rule) |

Contrast: ink/surface ≈ 19:1 light, 18:1 dark. Accent/surface ≈ 4.1:1 — borderline AA for normal text but passes for large text + UI; coral is intentional brand colour, used for large headlines + CTAs only.

### Typography

- **Display:** `'Geist', 'Inter Tight', system-ui, -apple-system, 'Segoe UI', sans-serif`
- **Body:** `'Geist', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`
- **Mono:** `'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace`
- **Base size:** 16px.

### Motion (`expressive-bold` profile — springy overshoot)

| Token | Agency value | Default |
| --- | --- | --- |
| `--motion-duration-fast` | 200ms | 150ms |
| `--motion-duration-base` | 320ms | 250ms |
| `--motion-duration-slow` | 600ms | 400ms |
| `--motion-duration-deliberate` | 900ms | 700ms |
| `--motion-ease-standard` | `cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoot) | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--motion-ease-emphasized` | `cubic-bezier(0.68, -0.55, 0.32, 1.55)` (anticipate + overshoot) | `cubic-bezier(0.2, 0, 0, 1)` |
| `--motion-distance-sm/md/lg` | 16 / 48 / 120 px | 8 / 24 / 64 px |

Reduced-motion users still get instant transitions via `--motion-scalar`.

## Header behaviour — `hide-on-down-show-on-up`

Sticky nav with `backdrop-filter: blur(8px)` + `border-bottom: 1px solid var(--color-rule)`. On scroll DOWN, translates to `translateY(-100%)` (hidden); on scroll UP, returns to `translateY(0)` (visible). The scroll-direction observer that toggles `.is-hidden` is wired client-side (slot exists in the main-nav module).

## Module style hints

- `hero: oversized-type` — `clamp(3rem, 12vw, 9rem)` headline.
- `timeline: horizontal-scroll` — Timeline module renders horizontally on agency theme; ProcessTimeline (vertical) stays vertical.
- `projectCaseStudy: scroll-tied` — large `clamp()` titles + accent-coloured metric blocks.
- `metricsCallout: big-number` — `clamp(3rem, 6vw, 5rem)` numbers + mono description below.
- `beforeAfterSlider: edge-to-edge` — sharp 0-radius drag handle.
- `posts: asymmetric` — masonry column-count layout.

## Visual baselines

`tests/e2e/visual/themes/agency.spec.ts` walks every `EItemType` under `[data-theme-name="agency"]`. Baselines under `tests/e2e/visual/__snapshots__/themes/agency/`. Capture:

```bash
npx playwright test --project=visual tests/e2e/visual/themes/agency.spec.ts --update-snapshots
```

## Follow-ups

- **Scroll-direction observer** for the hide-on-down header — currently the SCSS slot exists (`.main-nav.is-hidden`); a JS hook needs to toggle `.is-hidden` based on scroll delta.
- **Surface-level baselines** under agency — homepage / case studies / project tile grid; pending site-wide theme switching.
- **Self-hosted Geist** via `siteFlags.selfHostFonts: true`.
- **Stitch frames** — high-fidelity design pass.
