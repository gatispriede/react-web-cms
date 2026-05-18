# Local Business — first-class theme

**Status:** shipped (this commit). Per-theme baseline pass under `tests/e2e/visual/themes/local-business.spec.ts` (to land in the visual-baselines follow-up).

## Target audience

Local trade and service businesses — electricians, plumbers, opticians, locksmiths, garages, small workshops, single-operator service companies. The neighbourhood-leaflet, "we're a real business at this address" tier.

## Mood

Warm · honest · trustworthy · photo-led · approachable.

Translates to:
- **Warm off-white surface** (`#FBFAF7`) with deep trust-blue accent (`#15467A`). Light-default — trade-business sites convert better in light. A flat amber secondary (`#D97706` "trade hi-vis") highlights CTAs and section underlines without ever forming a gradient.
- **Roboto Slab + Source Sans 3.** Slab display reads as honest signage / hand-painted van lettering — distinct from Editorial's literary serif, Restaurant's Fraunces, SaaS Landing's Mona Sans, Agency's Geist. Source Sans 3 body reads larger (17px base) for the "viewed at arm's length on a workshop bench" use case.
- **Gentle-slow motion** (260ms base) — same family as Editorial / Restaurant. Trade businesses don't need snap.
- **6px radii.** Softer than Agency (0px), tighter than SaaS Landing (12px) and Commerce (8px). Reads as printed-signage corners rather than app-y rounded.
- **NO gradients.** Honest businesses don't use gradients. Everything is flat fills + the amber hi-vis stripe (button shadows, button underlines, section headings, hero portrait frame, footer top-border).

## When to pick this

- Trade businesses with a single proprietor / small team — plumbers, electricians, opticians, locksmiths, garages, mobile mechanics, joiners, painters, roofers.
- Service businesses where the page anatomy is: proprietor photo + phone number + services + certifications + testimonials + opening hours + before/after gallery.
- Sites where "honest, warm, trust-signal-heavy, NOT cinematic, NOT corporate" is the brief.

## When NOT to pick this

- Content-led sites — use `editorial` (cream + serif).
- Product shops — use `commerce` (white + emerald + snappy retail).
- Agency / case-study portfolios — use `agency` (sharp + expressive + 0px radii).
- B2B SaaS landing pages — use `saas-landing` (dark + violet gradient).
- Restaurants / cafés — use `restaurant` (warmer khaki + Fraunces + food-photo-led).

## File layout

| File | Role |
| --- | --- |
| `theme.json` | Canonical manifest. |
| `theme.scss` | Semantic tokens + body baseline + extra warm/trust-ok custom properties. |
| `module-styles.scss` | Per-module overrides — sticky-static header with phone-link underline, proprietor-photo split hero with amber stripe, numbered services list, large always-visible OpeningHours card, phone-up-front ContactBlock, photo-card Testimonials with amber quote glyph, uniform-grid Gallery with amber caption bar, certification-pill TrustBadges, flat service-tier PricingTable with amber top-stripe on the highlighted plan, soft-pill SkillPills, callback-request InquiryForm, small-business-promise Manifesto, framed MoneyBackGuarantee, hi-vis amber-shadow CTAs, vertical spine Timeline, ProcessTimeline, MetricsCallout, StatsStrip, StatsCard, ComparisonTable, BeforeAfterSlider, BlogFeed card grid, minimal-1row footer with hi-vis top border. |
| `product-templates.scss` | No-op placeholder. |
| `README.md` | This file. |

## Tokens

### Palette

| Token | Light | Dark |
| --- | --- | --- |
| `--color-surface` | `#FBFAF7` (warm paper) | `#1A1815` |
| `--color-ink` | `#1F1B16` | `#F2EDE5` |
| `--color-accent` | `#15467A` (deep trust blue) | `#5EA0E0` |
| `--color-accent-ink` | `#FFFFFF` | `#0A1A2C` |
| `--color-surface-inset` | `#F2EEE5` | `#23201B` |
| `--color-rule` | `#D8D1C2` | `#3A352E` |
| `--color-warm` | `#D97706` (trade hi-vis amber) | `#F59E0B` |
| `--color-trust-ok` | `#15803D` (open-now / verified) | `#4ADE80` |

### Typography

- **Display:** `'Roboto Slab', 'Source Serif 4', Georgia, ...` — slab serif, signage character
- **Body:** `'Source Sans 3', 'Inter', ...` — 17px base, readable at arm's length
- **Mono:** ui-monospace — minimal use

### Motion (`gentle-slow`)

150 / 260 / 420 / 680ms with smooth eases.

### Radii

6px — distinctly softer than Agency's 0px, tighter than SaaS Landing's 12px and Commerce's 8px.

## Header behaviour — `sticky-static`

Stays put on scroll. Phone-link in nav gets a permanent amber underline + handset glyph so the "call us" CTA is always one tap away. On scroll past ~80px the bottom rule thickens and a soft drop shadow appears (toggled via `.is-scrolled` class).

## Module style hints

- `hero: proprietor-photo-split-phone-cta` — split hero, framed portrait right, oversized phone CTA in copy column, amber stripe under both.
- `services: numbered-list-trust-led` — printed-leaflet services list with oversized slab numerals.
- `openingHours: always-visible-large` — pinned framed card with "OPEN NOW" status + weekday table.
- `contactBlock: phone-up-front` — phone link rendered as the card hero in slab + amber underline.
- `testimonials: photo-card-quote` — photo-card grid with amber quote glyph.
- `gallery: before-after-grid` — uniform 3-col grid, amber caption bar under each image.
- `trustBadges: certification-pills` — outlined chips with green check glyph ("Gas Safe", "NICEIC", "Public liability insured").
- `pricingTable: service-tier-flat` — three flat cards, highlighted plan gets amber top-stripe + "Most requested" label.
- `skillPills: soft-pill-row` — outlined pill row for quick-scan service lists.
- `manifesto: small-business-promise` — slab-italic pull-quote with amber leading quote mark.
- `moneyBackGuarantee: framed-promise` — left-stripe amber promise block ("no fix, no fee").
- `inquiryForm: callback-request` — compact "Request a callback" card.
- `posts: card-grid` — standard 3-up.

## Signature module pack

Hero + Services + OpeningHours + ContactBlock + Testimonials + Gallery + TrustBadges + Manifesto + MoneyBackGuarantee — the trade-business page anatomy. PricingTable + ComparisonTable cover service-tier sites; ProcessTimeline + StatsStrip cover "how we work" + "why us" sections.

## Visual baselines

```bash
npx playwright test --project=visual tests/e2e/visual/themes/local-business.spec.ts --update-snapshots
```

## Follow-ups

- Visual-baseline spec under `tests/e2e/visual/themes/local-business.spec.ts`.
- Self-hosted Roboto Slab + Source Sans 3 via `siteFlags.selfHostFonts`.
- Stitch frames for hero + services + opening-hours + contact-block.
