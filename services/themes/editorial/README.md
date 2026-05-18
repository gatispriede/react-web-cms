# Editorial — first-class theme

**Status:** shipped 2026-05-13. Q4-cap baselines committed; per-theme baseline pass `tests/e2e/visual/themes/editorial.spec.ts` ships alongside.

## Target audience

Writers, photographers, single-author journalism, considered portfolios. The theme leans **reading-first** — long-form text, photo essays, author-led blogs, consultant/architect-portfolio sites. Same audience Vogue / Wallpaper / Magazine sites lean on, but warmer.

## Mood

Quiet · literary · spacious · deliberate · warm.

Translates to:
- **Cream paper, not white.** `#FAF7F2` surface reads as printed page; lowers eye strain on long-form text vs pure white.
- **Serif display, sans body.** Source Serif Pro for headings (high-quality variable serif, GDPR-proxied or self-hosted via the existing font pipeline). Inter for body — the most-read sans on the web; pairs well with serifs without competing.
- **Slow + deliberate motion.** `--motion-duration-base: 400ms` (vs the 250ms default); `--motion-duration-deliberate: 1100ms` for hero reveals. Each interaction feels like turning a page. Reduced-motion users still get instant transitions — `--motion-scalar` gates everything.
- **Hairlines, not radii.** `--theme-borderRadius: 2px`. Cards + buttons + chips render flat; editorial doesn't ask for soft Material-shadowed cards.
- **Terracotta accent.** `#B85C38` — warm, considered, paper-compatible. Reads as ink-and-pigment rather than digital primary.

## When to pick this

- Long-form text (essays, journalism, photo essays).
- Author-led portfolios — consultants, designers, architects, photographers, journalists.
- Sites where reading comfort beats conversion friction.
- "Magazine" or "publication" framing in the brand voice.

## When NOT to pick this

- Product shops with high SKU velocity — use `commerce` (snappy hover, tight grid).
- Agency case studies that lean on motion — use `agency` (expressive-bold motion profile).
- Booking-led sites (restaurant, local business, events) — use the dedicated theme for each.
- Anywhere conversion-rate-optimised buttons matter — Editorial's slow motion + flat buttons are a brand-statement trade.

## File layout

| File | Role |
| --- | --- |
| `theme.json` | Canonical manifest — palette (light + dark), typography stacks, motion profile, header/footer behaviour, module-style hints. Read by `ThemeRegistry` at boot. |
| `theme.scss` | Semantic-token overrides scoped under `[data-theme-name="editorial"]`. Sets `--color-*`, `--font-*`, `--motion-duration-*` custom properties + body baseline. |
| `module-styles.scss` | Per-module overrides — Hero (full-bleed overlay nav), Gallery (magazine spread), Manifesto (large-type pull-quote), Timeline (broken-grid), Footer (hairline top rule), Breadcrumb (uppercase tracking), plus token-driven polish for all 47 catalogue modules (commerce, customer-account, cars, restaurant, event, SaaS, agency-portfolio). |
| `product-templates.scss` | (legacy slot, retained for Phase 1.F product display templates). |
| `README.md` | This file — design doc + audience + when-to-pick + when-not. |

## Tokens

### Palette (light → dark via `light-dark()`)

| Token | Light | Dark |
| --- | --- | --- |
| `--color-surface` | `#FAF7F2` (cream paper) | `#161412` (warm near-black) |
| `--color-ink` | `#1A1814` (deep ink) | `#EDE9DE` (warm off-white) |
| `--color-accent` | `#B85C38` (terracotta) | `#D87A52` (lifted terracotta) |
| `--color-accent-ink` | `#FAF7F2` | `#16140F` |
| `--color-surface-inset` | `#F2EEE3` | `#1F1B16` |
| `--color-rule` | `#D8D1BF` | `#3A332C` |

Contrast: ink/surface ≈ 14:1 light, 13:1 dark. Accent/surface ≈ 4.8:1 light, 5.2:1 dark — passes WCAG AA for normal text, AAA for large text.

### Typography

- **Display:** `'Source Serif Pro', ui-serif, Georgia, 'Times New Roman', serif`
- **Body:** `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`
- **Mono:** `ui-monospace, 'SF Mono', Menlo, monospace`
- **Base size:** 17px (one notch up from the 16px default — editorial reads better at 17).

Both webfonts are pulled via the existing font pipeline (`_document.tsx` extracts the leading quoted family, builds a Google Fonts URL, optionally proxies through `/api/fonts/css` when `siteFlags.selfHostFonts === true` to keep visitor IPs out of Google's logs).

### Motion

`gentle-slow` profile:

| Token | Editorial value | Default |
| --- | --- | --- |
| `--motion-duration-fast` | 240ms | 150ms |
| `--motion-duration-base` | 400ms | 250ms |
| `--motion-duration-slow` | 640ms | 400ms |
| `--motion-duration-deliberate` | 1100ms | 700ms |
| `--motion-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--motion-ease-emphasized` | `cubic-bezier(0.05, 0, 0.05, 1)` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--motion-distance-sm/md/lg` | 12 / 32 / 96 px | 8 / 24 / 64 px |

`prefers-reduced-motion: reduce` flips `--motion-scalar` to 0 globally — every duration collapses to instant regardless of token value.

## Header behaviour — `centered-hero-integrated`

Default nav state floats over the hero image with text shadow for contrast. On scroll past the hero's bottom edge, the nav condenses to a sticky slim bar with `backdrop-filter: blur(6px)` and the cream surface tint. Toggle is client-side via an `is-condensed` class added by an IntersectionObserver on the hero (slot wired in the Hero module).

## Module style hints (consumed by Hero, Timeline, Posts, Gallery, ProjectGrid)

- `hero: full-bleed-overlay-nav` — Hero renders min-height 75vh, overlaid headline + subtitle.
- `timeline: broken-grid` — alternating-side entries with a hairline rule and an accent dot anchor.
- `posts: editorial` — BlogFeed renders a single-column 64ch reader-width list with serif titles.
- `gallery: magazine-spread` — asymmetric grid; every 3rd item spans two columns.
- `project-grid: asymmetric` — masonry column-count layout with mixed tile sizes.

## Visual baselines

`tests/e2e/visual/themes/editorial.spec.ts` walks every `EItemType` under `[data-theme-name="editorial"]` and captures one snapshot per type. Baselines live at `tests/e2e/visual/__snapshots__/themes/editorial/`. Capture run path is identical to the Q4-cap default-theme run:

```bash
npx playwright test --project=visual tests/e2e/visual/themes/ --update-snapshots
```

After capture, eyeball every PNG in the diff before committing. Any baseline that shifted between default and editorial is the intended theme effect; one that didn't shift is a clue the per-module override didn't fire.

## Follow-ups (each its own jump)

- **Surface-level baselines under editorial** — homepage, blog index, product detail, checkout: re-capture the 9 surfaces in `surfaces.spec.ts` once theme switching can drive the site-wide active theme programmatically.
- **Dark-mode baselines** — the palette ships dark values but the visual baselines are light-only by default. Wave 5b adds the dark snapshot project after admin-dark-mode-audit lands.
- **Self-hosted webfonts** — Source Serif Pro + Inter via `siteFlags.selfHostFonts: true` to dodge the Google Fonts CDN entirely. Operator decision per GDPR posture.
- **Stitch frames** — high-fidelity design pass for the hero + manifesto + gallery + footer; commit under `docs/audits/editorial-2026-05-XX/` for design-language reference.
