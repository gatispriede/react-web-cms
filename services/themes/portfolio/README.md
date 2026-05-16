# Portfolio — first-class theme

**Status:** shipped 2026-05-16.

## Target audience

Individual creative professionals — designers, photographers, freelance developers, illustrators, writers. Solo voice. The "personal brand" tier — where the person and the work are the product.

## Mood

Warm · minimal · personal · considered · human.

Translates to:
- **Warm cream surface (#FAF7F2) + warm dark ink (#1F1A16) + terracotta accent (#C2410C).** Quiet warmth. The accent reads as terracotta / burnt sienna — earthy, not aggressive.
- **Fraunces display + Inter body.** Fraunces is a variable serif with optical sizing and a SOFT axis — set large it's editorial and modern; italic-stressed em-runs become a quiet personal voice. Inter for body. JetBrains Mono lowercase for metadata.
- **Gentle-considered motion.** Soft eases, longer durations, short reveal distances (8 / 20 / 48 px). Nothing snaps; nothing overshoots.
- **8px soft radii** — soft but not pillowy. The design feels hand-set.
- **Sticky-static header** — restrained, hairline-ruled. The work breathes below.
- **First-person voice everywhere.** Italics for emphasis ("I design products at the intersection of…"). Lowercase mono labels ("currently — building at"). Different from agency's third-person studio voice.

## When to pick this

- One-person portfolios — designer, photographer, illustrator, freelance dev, writer.
- Sites where the person is the brand and the work is intimate.
- Reading-first portfolios that still want a photo-led project grid.
- Anywhere "considered, warm, human" is the desired vibe.

## When NOT to pick this

- Multi-person studios — use `agency` (stark + brutalist + team voice).
- Editorial / journal-style sites — use `editorial` (warm cream too, but serif-led long-form, not project-grid led).
- Product shops — use `commerce`.
- SaaS / dev tools — use `saas-landing`.
- Restaurant / event / local business.

## File layout

| File | Role |
| --- | --- |
| `theme.json` | Canonical manifest. Read by `ThemeRegistry` at boot. |
| `theme.scss` | Semantic-token overrides scoped under `[data-theme-name="portfolio"]`. |
| `module-styles.scss` | Per-module overrides — Hero (portrait + statement split), ProjectGrid (asymmetric, soft-radius cover + serif title), Gallery (magazine spread, soft shadows), Timeline (centred vertical spine), SkillPills (lowercase pills), Testimonials (hand-set italic pull-quote, accent glyph), Manifesto (first-person display, accent italic em-runs), SocialLinks (prominent named, channels card-grid), List (chronological cases / credits roll), KeyValueDossier (credits), Buttons (accent pill), Cards (soft 10px hairline), Footer (minimal personal, italic wordmark). |
| `product-templates.scss` | (legacy slot retained). |
| `README.md` | This file. |

## Tokens

### Palette (light → dark via `light-dark()`)

| Token | Light | Dark |
| --- | --- | --- |
| `--color-surface` | `#FAF7F2` (warm cream) | `#161311` (warm near-black) |
| `--color-ink` | `#1F1A16` (warm dark) | `#F2EDE5` (warm cream) |
| `--color-accent` | `#C2410C` (terracotta) | `#FB923C` (warm orange — bumped for contrast) |
| `--color-accent-ink` | `#FFFFFF` | `#1F1A16` |
| `--color-surface-inset` | `#F2ECE2` | `#211C18` |
| `--color-rule` | `#D9CFC1` (soft warm rule) | `#3A332C` (soft warm rule) |

Contrast: ink/surface ≈ 14:1 light, 13:1 dark. Accent/surface ≈ 5.6:1 light — passes AA for normal text.

### Typography

- **Display:** `'Fraunces', 'Cormorant Garamond', 'Source Serif Pro', Georgia, serif`
- **Body:** `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`
- **Mono:** `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace`
- **Base size:** 17px (a notch larger than the other themes — reading-first).

### Motion (`gentle-considered` profile)

| Token | Portfolio value | Default |
| --- | --- | --- |
| `--motion-duration-fast` | 240ms | 150ms |
| `--motion-duration-base` | 420ms | 250ms |
| `--motion-duration-slow` | 720ms | 400ms |
| `--motion-duration-deliberate` | 1100ms | 700ms |
| `--motion-ease-standard` | `cubic-bezier(0.32, 0.08, 0.24, 1)` (gentle) | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--motion-ease-emphasized` | `cubic-bezier(0.22, 0.61, 0.36, 1)` (soft pull) | `cubic-bezier(0.2, 0, 0, 1)` |
| `--motion-distance-sm/md/lg` | 8 / 20 / 48 px | 8 / 24 / 64 px |

Reduced-motion users still get instant transitions via `--motion-scalar`.

## Module style hints

- `hero: portrait-led-statement` — portrait beside the headline; "currently —" status strip in mono.
- `projectGrid: asymmetric-personal` — soft-radius covers; every second tile drops 2rem.
- `gallery: magazine-spread` — asymmetric grid with hero tiles every 7 items.
- `timeline: vertical-spine` — centred spine, alternating side, accent dots.
- `skillPills: lowercase-pill` — rounded pills, hairline border, accent tint on hover.
- `testimonials: hand-set-pullquote` — italic serif quote, large accent opening glyph.
- `manifesto: first-person-display` — Fraunces display, italic accent em-runs.
- `socialLinks: prominent-named` — channels variant becomes a card grid with platform + handle + open affordance.
- `posts: list-led-no-cover` — restrained list, no thumbnails.

## Follow-ups

- Visual baselines under `tests/e2e/visual/__snapshots__/themes/portfolio/`.
- Self-hosted Fraunces variable font via `siteFlags.selfHostFonts: true`.
- Stitch frames — high-fidelity design pass for hero + project grid + about.
