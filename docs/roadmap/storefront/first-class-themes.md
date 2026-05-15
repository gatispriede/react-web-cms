---
name: first-class-themes
description: Replace low-value preset themes with a curated set of first-class designed themes (≥5), each with its own design doc, animations, header+logo + footer styling, plugin wiring, module-styling coverage, and mobile parity. Use Stitch (Google) as the design-source tool.
---

# First-class themes — Stitch-designed, full coverage, per-audience

## Goal

Today's themes (`Paper`, `Studio`, `Industrial`, `HighContrast` — seeded via [themes-as-files.md](../platform/themes-as-files.md)) are **token re-skins**: a palette, a font, a radius. They don't differentiate the product. Several read as "simpleton" placeholders that give a prospect no reason to pick this CMS over a Squarespace template.

Replace them with **first-class, designed themes** — each one a complete look-and-feel system covering:

- header (with logo placement variants) + footer styling
- in-page animations (scroll-in, hover, transitions, header behavior on scroll)
- per-module styling so every existing module type (Hero, Timeline, Paper-grid, Gallery, INFRA_TOPOLOGY, Posts, Products, Forms, Footer, …) actually looks intentional under that theme, not the default with a tinted accent
- plugin styling hooks where a theme needs functionality, not just CSS (e.g. animated header with sticky shrink, marquee strip, image-reveal-on-scroll)
- mobile parity — every theme designed mobile-first, no theme that "only works on desktop"

Each theme ships with a **design document** describing how / why / target audience / mood / design elements, committed alongside the theme files.

Designed in **Google Stitch** (the source-of-truth design tool), then handed off to code as the SCSS theme file + theme JSON + any plugin/module additions needed to support the look.

## Why now

- **Core product positioning.** Per [project_mcp_value_proposition.md](../../C:/Users/User/.claude/projects/D--Work-redis-node-js-cloud/memory/project_mcp_value_proposition.md), MCP turns natural language into ready pages with modules + themes. The "+ themes" half is currently weak — if the agent can stamp out a site in 30 sec but every site looks like a 2014 startup landing page, the value collapses at the demo.
- Operator feedback consistently asks "which one do I pick?" — current themes don't have legible target audiences.
- The themes-as-files scaffolding ([themes-as-files.md](../platform/themes-as-files.md)) already exists. JSON + SCSS pair per theme, bootstrap loader, "Reset to preset". The slot is wired; the content is what's missing.
- Pairs with [logo-style-options.md](../content/logo-style-options.md) — header logo is a per-theme decision, not a global one.

## Design

### Scope per theme — what "first-class" means

Each theme is a self-contained design system, not just tokens. A theme is **done** when all of these are true:

1. **Design doc** at `ui/client/themes/<slug>/README.md` — covers:
   - Target audience (who is this site for: agency, restaurant, photographer, SaaS landing, …)
   - Mood / voice (3-5 adjectives)
   - When to pick this theme (and when not to)
   - Reference inspirations (linked frames in Stitch)
   - Design elements catalogue: type scale, color palette, motion principles, signature components
2. **Theme tokens** at `ui/client/themes/<slug>/theme.json` — **existing pattern**, `ThemeService.bootstrap()` already loads JSON presets. Each theme ships **both light and dark** values via the `light-dark()` CSS function — mode = brightness, theme = identity, independent axes. Extend `IThemeTokens` shape with new fields if a theme needs them (motion durations override, header behavior enum, footer layout enum) — schema additions, not just data.

   Token hierarchy (per [project-standards-additions-2026-05-12](../_meta/project-standards-additions-2026-05-12.md) §5):
   - **Primitive** — `--blue-500`, `--space-4`, `--font-serif` — theme-independent, shared
   - **Semantic** — `--color-surface`, `--color-accent`, `--space-section`, `--font-display` — **per-theme override target**
   - **Component** — `--btn-primary-bg`, `--card-padding` — reads from semantic

3. **Per-theme SCSS at `ui/client/styles/Themes/<Slug>.scss`** — **net-new layer.** Today's themes are token-only. First-class themes introduce this layer for animations + per-module styling that tokens can't express. Token-driven, no hardcoded values (per project standards). Pairs with the dark-mode-audit `cssVar: true` enablement — once on, per-theme SCSS consumes both AntD tokens and theme-specific custom properties via the same `var(--*)` mechanism.

   Per-theme SCSS structure:
   ```scss
   /* ui/client/styles/Themes/Editorial.scss */
   [data-theme="editorial"] {
       /* semantic overrides */
       --color-surface: light-dark(#fdfdfd, #161616);
       --color-ink:     light-dark(#1a1a1a, #ededed);
       --color-accent:  light-dark(#c8102e, #ff5566);
       --font-display:  var(--font-serif);
       --font-body:     var(--font-sans-humanist);

       /* motion override — slow + gentle */
       --motion-duration-base: 400ms;
       --motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);

       @use './partials/editorial-modules';
       @use './partials/editorial-header';
       @use './partials/editorial-footer';
       @use './partials/editorial-animations';
   }
   ```
4. **Header styling** — including logo treatment (size / position / variant per theme), scroll behavior (sticky / shrink / hide-on-scroll-down), nav rendering, mobile drawer styling.
5. **Footer styling** — layout (stacked / multi-column / minimal), logo echo, social / contact treatment.
6. **Per-module styling pass** — every existing module type rendered under the theme and reviewed in a visual baseline. No module left looking like the default with the wrong accent color.
7. **Animations** — entry animations, hover states, transitions, page-load behavior. Implemented as either pure SCSS (preferred) or a per-theme `motion.ts` that wires GSAP/Framer/CSS-only as needed. Reduced-motion media query respected.
8. **Mobile design** — designed in Stitch at 375 px alongside the desktop frames; no theme ships without explicit mobile coverage.
9. **Plugin / module additions where required** — if a theme needs a marquee strip, a hero with cursor-follow image-reveal, an animated counter, a horizontal-scroll section, then the supporting module type (or extension to an existing one) is part of the theme deliverable, not a separate ticket.

### What gets removed

The current `Paper` / `Studio` / `Industrial` / `HighContrast` set is **not load-bearing as content** — it's load-bearing as a baseline. Keep one of them (probably `Paper`, the most-edited preset on funisimo.pro) as a clean editorial baseline. Drop the rest, or fold their distinct ideas into one of the new first-class themes.

### Scale — 8 themes (revised from 5 after research)

Research-validated lineup. Gaps that the original 5 missed:

- **Portfolio / Personal** — #1 category on Framer marketplace; distinct from agency (team vs individual)
- **Restaurant / Hospitality** — "local-business" is too generic; restaurants need menu + reservations + gallery + photo-heavy hero

Final 8:

| Slug | Target audience | Mood | Header behavior | Footer | Differentiator vs siblings |
|---|---|---|---|---|---|
| `editorial` | Writers, photographers, journalism | Quiet, generous whitespace, serif display | Hide-on-down / show-on-up (Headroom — Medium pattern) | Minimal, 1 row | Slow + gentle motion, broken grid |
| `agency` | Design / dev / marketing agencies | Bold, motion-forward, **dark-default** | Shrink-on-scroll | Multi-column | **Case-study-led storytelling**, oversized type, view-transitions between projects |
| `commerce` | Small product shops, makers | Catalogue-first, tight grid, soft palette | Shrink-on-scroll | Brand-led XXL (video bg, oversized wordmark) | Product-as-art, 3D viewers, scroll-snap galleries — also home of ss.com cars |
| `local-business` | Salons, services, generic small biz | Warm, photo-heavy, prominent contact CTA | Sticky-static | Multi-column | Trust signals first (phone CTA, map, reviews above fold) |
| `restaurant` | Restaurants, cafés, bars | Photo-heavy, warm palette, large display type | Sticky-static + book-a-table CTA | Multi-column (hours, location, contact) | Menu module, reservation widget, IG-grid integration |
| `saas-landing` | Software products | Sharp, animated, gradient accents, **dark-default** | Shrink-on-scroll | Minimal | **Product-screenshot-led**, feature grid, pricing table module, sticky mobile CTA |
| `event` | Conferences, performances, launches | Time-anchored, immersive hero (video/3D), bold expressive type | Centered, hero-integrated | Brand-led XXL with sponsor logos | Countdown module, sticky "Buy Tickets" CTA |
| `portfolio` | Individual designers, photographers, devs | Personal-first, single-page-feel, large project hero | Sticky-static minimal | Minimal | Project case-study scroll-driven reveals; "About me" + contact integrated |

Critical differentiation calls from research:

- **`agency` vs `saas-landing` overlap risk** — both dark + oversized type. Differentiate hard: agency = case-study scroll storytelling + project tiles. SaaS = product screenshots + feature grid + pricing table built-in. **Different module sets, not just different colors.**
- **`commerce` vs `restaurant` vs `local-business`** — commerce is catalogue-first (many products, grid). Restaurant is hospitality-first (menu, photos, reservation). Local-business is the catch-all (services + contact + trust).
- **`portfolio` vs `agency`** — team vs individual. Portfolio is single-person voice; agency is team / brand voice.

Retire the four current presets (`Paper` / `Studio` / `Industrial` / `HighContrast`). Keep ONE (`paper`) as a baseline-renamed-to-`editorial` migration target until ≥3 first-class themes ship.

### Stitch as design source — with reality check

Research finding (binding): **Stitch (Google) output is 70-90% structurally correct but NOT componentized, no design tokens or brand guidelines auto-applied, no animation export.** Treat Stitch output as a **structural draft only**.

Workflow:

1. **Design in Stitch.** Each theme has a Stitch project; final frames (desktop + 375 px mobile) cover every module type + header + footer + 404 + empty state + email.
2. **Lift the markup structure** from Stitch's exported HTML — DOM hierarchy + semantic roles + accessibility attributes.
3. **Throw away Stitch's inline classes.** They don't know our token system; re-skinning against our SCSS tokens is the rewrite.
4. **Animations are NOT exported by Stitch** — spec them in the design doc (referencing our motion-token system). Implementation is SCSS-first; JS-driven only where SCSS can't reach.
5. **Brand guidelines NOT auto-applied** — review the lifted markup against the theme's design doc for type scale, palette, spacing.
6. **No theme merges without its Stitch frames committed** (link in `ui/client/themes/<slug>/README.md`).

Optional: pull Stitch frames into Figma (via the round-trip) for component-system extraction. Defer if time-bound.

### Header logo per theme

Today the logo is a single global asset. Themes will want:
- different lockups (wordmark vs mark-only vs combined)
- different placements (center vs left, with vs without divider)
- different sizes responsive to scroll state

Two viable approaches:
- **A.** Per-theme logo treatment is purely visual — the same logo asset rendered with theme-driven CSS (size, padding, position, hide-mark-on-scroll). Cheaper, no new admin surface.
- **B.** Logo asset can be theme-specific — multi-variant logo schema in the existing logo flow ([logo-style-options.md](../content/logo-style-options.md)). More flexible, more admin surface.

Default to **A**; promote to **B** only if a theme genuinely needs a different mark, not just a different size.

### Mobile parity

Every theme ships with mobile frames designed in Stitch alongside desktop. Mobile is not a "minified desktop" — themes can declare different mobile primary-CTAs, different nav patterns (drawer vs bottom tab vs hamburger), different module orderings. Reuse the [mobile-column-behavior.md](../platform/mobile-column-behavior.md) `mobileBehavior` field — each theme can default `'stack'` / `'collapse'` / `'keep-ratio'` per section role.

## Files to touch

Per theme:
- `ui/client/themes/<slug>/README.md` — design doc
- `ui/client/themes/<slug>/theme.json` — tokens
- `ui/client/styles/Themes/<Slug>.scss` — SCSS
- `ui/client/styles/Themes/<Slug>/_modules.scss` — per-module overrides (one partial per touched module, or a single bundle file — TBD during the first theme build)
- `ui/client/themes/<slug>/motion.ts` (optional) — JS-driven animations where SCSS can't reach

Cross-cutting:
- `services/ThemeService.ts` — bootstrap loader already exists; extend `IThemeTokens` if new fields are needed (motion enums, header behavior enum, footer layout enum)
- `shared/types/ITheme.ts` — extend tokens
- `ui/admin/features/Theme/ThemePresetGallery.tsx` (simplified-mode preset gallery, already ships) — render each new theme with its hero preview frame from Stitch
- `ui/admin/features/Theme/ThemeEditor.tsx` (advanced mode) — surface any new token fields
- Tests:
  - Per-theme visual baseline e2e at desktop + 375 px (depends on Q4-cap baselines existing)
  - Manifest test verifies every theme directory has the required files (README, theme.json, SCSS)

## Acceptance

1. ≥5 first-class themes shipped, each with: design doc, theme.json, SCSS, all module types styled, header+logo treatment, footer styling, animations, mobile design.
2. Theme preset gallery in admin shows each new theme with a real preview frame, not the current generic swatch.
3. The retired simpleton themes are removed (or one kept as the baseline) without breaking existing sites — migration path: when boot finds a site on a removed theme, fall back to the chosen baseline + show a one-time admin banner to pick a new theme.
4. Every theme passes a manual review against its target-audience criteria from its design doc.
5. Mobile (375 px) visual baseline exists for every theme.
6. `prefers-reduced-motion` disables non-essential animations across all themes.

## Effort

**XL — multi-week, parallelisable per theme.** Each theme is its own jump (per [delivery philosophy §13](../_meta/project-standards-additions-2026-05-12.md#13-delivery-philosophy--jumps-not-iterations)).

Per-theme AI agent estimate:
- Design doc + Stitch-frame markup lift: **~2-3 h AI** (Stitch design itself is wall-clock; AI compresses the markup-lift step, not the design pass)
- Tokens (light + dark via `light-dark()`): **~1 h AI**
- Per-theme SCSS layer (semantic-token overrides + per-module partials): **~2-3 h AI**
- Header behavior + footer layout per the theme's table row: **~1-2 h AI**
- Per-module styling pass (over the ~14 existing + new modules consumed): **~3-5 h AI**
- Animation pass (motion-token reads + scroll-driven where applicable): **~1-2 h AI**
- Theme-specific new modules (see [new-modules-catalogue.md](../_meta/new-modules-catalogue.md) for which modules per theme): **~3-8 h AI** depending on the module count
- WCAG 2.2 AA audit pass on the theme: **~1-2 h AI**
- Visual baseline + e2e: **~1 h AI**

Per-theme AI budget: **~14-25 h AI**.
8 themes aggregate: **~110-200 h AI**, parallelisable.

Wall-clock blockers (NOT in the AI budget): Stitch design pass, operator review of theme look + feel, content seeding for sample pages per theme.

## Dependencies

- **[themes-as-files.md](../platform/themes-as-files.md)** — shipped; provides the slot.
- **Q4-cap visual baselines** — strongly desired before this lands, so per-theme baselines have somewhere to live.
- **[logo-style-options.md](../content/logo-style-options.md)** — header logo treatment is theme-driven; reconcile field shapes before starting.
- **[mobile-column-behavior.md](../platform/mobile-column-behavior.md)** — themes set per-section mobile defaults; ship that field first.
- **[module-transparency-style.md](../content/module-transparency-style.md)** — fold into the per-theme module styling pass.

## Open questions

1. Keep `Paper` as the baseline, or build a new "editorial" theme to replace it?
2. Logo per-theme: pure CSS treatment (A) or multi-variant asset (B)? Default A unless a theme proves otherwise.
3. Animation framework: pure SCSS + CSS custom properties only, or allow Framer Motion / GSAP per-theme `motion.ts`? Lean SCSS-first; add JS only when SCSS genuinely can't.
4. Do we keep the "user can edit theme tokens" advanced flow? Probably yes — first-class themes are starting points, not locked templates.
