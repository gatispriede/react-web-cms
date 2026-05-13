# SaaS Landing — first-class theme

**Status:** shipped 2026-05-13. Per-theme baseline pass `tests/e2e/visual/themes/saas-landing.spec.ts` ships alongside.

## Target audience

B2B SaaS landing pages, developer tools, API products, infra companies. The Stripe / Linear / Vercel / Resend tier — dark-default by convention, gradient accents on hero + pricing, JetBrains Mono on version tags.

## Mood

Tech-modern · confident · sharp · gradient-aware · conversion-funnel.

Translates to:
- **Dark default surface** (`#0F172A` slate-950) with violet accent (`#A78BFA`). Light mode flips palette. Dark-by-default matches the genre convention; light mode exists for users who explicitly opt out.
- **Mona Sans + Inter + JetBrains Mono.** Mona Sans (GitHub's variable display sans) gives a confident-but-friendly geometric character — distinct from Editorial's serif, Commerce's Space Grotesk, Agency's Geist. JetBrains Mono for version tags, code labels, and changelog metadata reads as "we ship code."
- **Snappy motion** (180ms base) — same scale as Commerce, but on top of a darker / gradient surface.
- **12px radii.** More rounded than Commerce (8px) or Agency (0px). Reads as "modern web app."
- **Violet gradient (`135deg, #A78BFA → #38BDF8`)** on hero halos, primary CTAs, highlighted pricing tier, and gradient-text spans. The gradient IS the visual identity.

## When to pick this

- B2B SaaS landing pages — pricing-table + feature-grid + product-screenshot-hero are the page primitives, all SCSS-polished in this theme.
- Developer tools, API products, infra (Cloudflare, Vercel, Linear, Resend, Supabase tier).
- Sites where dark-default + gradient accents are on-brand.

## When NOT to pick this

- Content-led sites — use `editorial` (cream + serif).
- Product shops — use `commerce` (white + emerald + snappy retail).
- Agency / case-study portfolios — use `agency` (sharp + expressive + 0px radii). Same dark-mode tendency but very different mood.
- Restaurants / local business — use `restaurant`.

## File layout

| File | Role |
| --- | --- |
| `theme.json` | Canonical manifest. |
| `theme.scss` | Semantic tokens + body baseline + `--accent-gradient` custom property consumed by hero / CTAs / pricing. |
| `module-styles.scss` | Per-module overrides — Hero (radial gradients + product-screenshot grid), pricing table (gradient-bordered highlighted tier + "Most popular" mono pill), feature grid (gradient-halo hover), logo cloud (monochrome→accent), changelog (mono version pills), integration grid + sponsor strip, product-screenshot-hero (signature SaaS module), testimonial wall (quote-mark accent), buttons (gradient on primary), token-driven polish across all 47 modules. |
| `product-templates.scss` | No-op placeholder. |
| `README.md` | This file. |

## Tokens

### Palette

| Token | Light | Dark |
| --- | --- | --- |
| `--color-surface` | `#FFFFFF` | `#0F172A` (slate-950) |
| `--color-ink` | `#0F172A` | `#E2E8F0` (slate-200) |
| `--color-accent` | `#7C3AED` (violet-600) | `#A78BFA` (violet-400) |
| `--color-accent-ink` | `#FFFFFF` | `#1E1B4B` |
| `--color-surface-inset` | `#F8FAFC` | `#1E293B` (slate-800) |
| `--color-rule` | `#E2E8F0` | `#334155` (slate-700) |

`--accent-gradient`: `linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 40%, #38BDF8))` — violet → sky-blue.

### Typography

- **Display:** `'Mona Sans', 'Inter Tight', ...` — variable display sans
- **Body:** `'Inter', ...`
- **Mono:** `'JetBrains Mono', ...` — version tags, changelog, breadcrumb, code

### Motion (`snappy-default`)

Same scale as Commerce — 100/180/280/480ms with standard eases.

### Radii

12px — distinctly more rounded than Commerce's 8px and Agency's 0px.

## Header behaviour — `sticky-static`

Stays put on scroll. `backdrop-filter: blur(12px)` always; on scroll past ~80px the bottom border transitions to a 1px violet→sky gradient (toggled via `.is-scrolled` class — observer wired client-side).

## Module style hints

- `hero: gradient-bg-product-screenshot` — radial gradients in the hero corners + product screenshot on the right.
- `pricingTable: highlighted-middle-tier-gradient` — middle tier gets a gradient-bordered card with a "Most popular" mono pill.
- `featureGrid: icon-on-gradient-tile` — cards get a violet-gradient halo on hover.
- `logoCloud: monochrome-hover-color` — logos render greyscale, fade to colour on hover.
- `changelogTimeline: version-tag-mono` — version numbers as `JetBrains Mono` violet-tinted pills.
- `posts: card-grid` — standard 3-up grid.

## Signature module pack

The themes-modules catalogue ships **PricingTable + FeatureGrid + ProductScreenshotHero + LogoCloud + TestimonialWall + IntegrationGrid + ChangelogTimeline** — all 7 SaaS-landing-specific modules already in tree. This theme is where they all reach their final form.

## Visual baselines

```bash
npx playwright test --project=visual tests/e2e/visual/themes/saas-landing.spec.ts --update-snapshots
```

## Follow-ups

- **Scroll observer** for the `.is-scrolled` gradient border on the sticky-static header.
- **Surface baselines** under saas-landing.
- **Self-hosted Mona Sans + JetBrains Mono** via `siteFlags.selfHostFonts`.
- **Stitch frames** for the hero + pricing + feature grid.
