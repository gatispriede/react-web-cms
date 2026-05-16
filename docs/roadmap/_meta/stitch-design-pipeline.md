# Stitch in the design pipeline

> Reference doc. Not a roadmap item. Codifies when to reach for Google
> Stitch, what to expect back, and how to turn its output into reusable
> typed modules in this codebase.

## What Stitch is

[Google Stitch](https://stitch.withgoogle.com) (Google Labs) is an
AI-driven UI ideation tool. Prompt in → mockup frames out, with optional
HTML/CSS or React-code export and Figma round-trip. Targets fast UI
exploration, not design-system maintenance.

**Stitch is good at:**
- Generating high-fidelity static visuals from a prose description
- Producing multiple stylistic variants of the same content shape in one batch
- Exporting frames as PNG, HTML/CSS, or React component code

**Stitch is bad at:**
- Type discipline (no `IContent` shape, no slot enforcement)
- Cross-component consistency (each frame stands alone unless you prompt for system rules)
- Logic, data binding, accessibility audits, responsive breakpoints
- Anything backend-shaped (auth, routing, persistence)

## Core principle for this project

> **Reusable, typed modules — not free-form rich text.**
>
> When operators repeatedly write free-form prose to describe structured
> content (heading + 3 bullets + CTA, feature comparison, pricing tiers,
> testimonial wall), that's a signal to ship a **module** for that shape,
> not document a "how to write good rich text" guide. Stitch is the
> fastest way to design the visual side of those modules — especially
> across the 5 remaining themes.
>
> `<RichText>` exists, but it's the fallback for genuine prose
> (blog body, long-form policy text). Not the default for structured
> content.

## When to reach for Stitch — decision tree

```
Operator content has predictable structure?
├── NO  → keep as <RichText>
└── YES → Does an existing module + variant cover it?
         ├── YES → use it; don't Stitch
         └── NO  → Is this a brand-new shape, or a theme-specific look on an existing one?
                  ├── shape   → Stitch a new module (frame → module pipeline below)
                  └── variant → Stitch theme frames (theme variant pipeline below)
```

**Don't reach for Stitch when:**
- The change is logic-only (validation rule, MCP tool, routing)
- An existing module's `moduleStyleHints` already nails it
- Backend / infra / migration work (app-router, dropship adapter, RSC fixes)
- Operator one-off content — they get modules, not Stitch

## Workflow A — Stitch frame → new reusable module

**1. Audit before you Stitch.** Grep first. Don't duplicate a module that exists:

```
grep -rli "<keyword>" ui/client/modules/
ls ui/client/modules/ | grep -i <keyword>
```

The current marketing-shape inventory (as of 2026-05-16):

| Shape | Module |
|-------|--------|
| Hero with CTA + screenshot | `Hero`, `ProductScreenshotHero` |
| 3-col feature grid | `FeatureGrid` |
| Logo wall | `LogoCloud` |
| Stat tile / row | `StatsCard`, `StatsStrip` |
| Big numbers callout | `MetricsCallout` |
| Integration grid | `IntegrationGrid` |
| Testimonials | `Testimonials`, `TestimonialWall` |
| Pricing table | `PricingTable` |
| Comparison table | `ComparisonTable` (commerce) / `CarComparisonTable` (cars) |
| Trust badges / money-back | `Trust/TrustBadges`, `Trust/MoneyBackGuarantee` |
| Changelog list | `ChangelogTimeline` |
| Image gallery | `Gallery`, `BeforeAfterSlider` |
| Stack of project cards | `ProjectGrid` |
| Plain prose | `RichText` |

If the shape's in this table, use the module. Stitch only fills genuine gaps.

**2. Prompt Stitch with discipline.** Include in the prompt:

- The theme name + accent palette (pull from `services/themes/<name>/theme.json`)
- Exact content slots — e.g. "headline (1 line), subhead (2 lines), 3 feature cells each with icon + heading + body, primary CTA, secondary CTA"
- Responsive expectations — "desktop 3-col, tablet 2-col, mobile stack"
- Output format — "React + CSS modules" if available, else HTML/CSS

**3. Extract structure from the frame.** Pull three things out:

| Output of Stitch | Where it lands in the codebase |
|------------------|-------------------------------|
| Slots (the operator-fillable bits) | `<Module>.types.ts` → `I<Module>` interface |
| Layout (grid/stack/columns/spacing) | `<Module>.tsx` JSX + `.scss` |
| Visual tokens (color/type/radius/shadow) | `services/themes/<theme>/theme.json` palette / `moduleStyleHints`, never hardcoded |

**4. Define the module.** Standard skeleton:

```
ui/client/modules/<Name>/
  <Name>.tsx          # display — Server-safe by default; "use client" only if interactive
  <Name>.types.ts     # I<Name> interface + parseContent()
  <Name>.scss         # cssVar-driven; import in pages/_app.tsx (RSC rule)
  index.ts            # re-export
ui/admin/modules/<Name>Editor.tsx   # form, mirror of <Name>.types
```

**5. Register the module.** Both halves:

- `ui/client/modules/clientItemTypes.ts` → display
- `ui/admin/modules/adminItemTypeEditors.ts` → editor

**6. Per-theme variant?** If Stitch gave a per-theme look (e.g. saas-landing's "icon-on-gradient-tile" feature grid), capture in the theme's `moduleStyleHints` + `theme.scss`, NOT in module SCSS. The module renders the same JSX; the theme paints it.

**7. Universal acceptance criteria** (these are non-negotiable per [README.md](../README.md) §Universal requirements):

- [ ] MCP coverage — module shape authorable via MCP tool (e.g. `page_update` section payload)
- [ ] `data-testid` on every interactive surface
- [ ] Visual baseline — entries in `tests/e2e/visual/modules/displays.spec.ts` + `editors.spec.ts`
- [ ] Docs — module catalogue updated, theme `moduleStyleHints` updated if used

## Workflow B — Stitch theme frames → existing modules, new look

For the 5 themes pending Stitch design (`local-business`, `saas-landing`,
`portfolio`, `agency`, `commerce`):

**1. Stitch produces frames per theme** — one per critical surface
(homepage hero, pricing, features, footer).

**2. Compare against existing module set.** For each frame, decide:

- Existing module + cssVar token tweak ✅ — best outcome, no code change
- Existing module + new theme-specific SCSS hook ⚠️ — add a `data-theme="<slug>"` SCSS branch
- New module needed ❌ — fall back to Workflow A

**3. Capture deltas in theme files:**

```
services/themes/<slug>/
  theme.json          # palette + typography + moduleStyleHints
  theme.scss          # per-theme cssVar overrides
  module-styles.scss  # per-module theme branches
```

## How I (Claude) work with Stitch in a session

I don't have direct Stitch API access. What I can do:

| You give me | I do |
|-------------|------|
| Stitch screenshot (PNG) | Read it visually, extract slots/layout/tokens, write the module + types + scss |
| Stitch HTML/CSS export | Convert to typed React + theme cssVars, strip hardcoded values |
| Stitch React export | Tighten types, replace inline styles with cssVars, wire into registries |
| Stitch prompt that didn't land | Suggest a tighter prompt grounded in our theme's `moduleStyleHints` |
| "Generate me a Stitch prompt for X" | Draft the prompt — theme name + palette + slot spec + responsive rules + output format |

If Stitch output drifts from our design system (hardcoded colors, custom
spacings outside the type scale, novel components for shapes we already
have), I push back rather than land it as-is.

## First POC target — saas-landing rich-text consolidation

Per spec ([first-class-themes.md](../storefront/first-class-themes.md)),
`saas-landing` is one of 5 pending themes. The audit:

**Theme exists**: `services/themes/saas-landing/theme.json` is already
defined — dark-default, violet `#7C3AED` accent, tech-modern, snappy
motion, `moduleStyleHints` set for hero/pricingTable/featureGrid/logoCloud/changelogTimeline/posts.

**Modules that cover saas-landing's typical content** (no Stitch needed,
all exist):

| Page section | Module |
|--------------|--------|
| Hero | `Hero` or `ProductScreenshotHero` |
| Trusted-by logos | `LogoCloud` |
| Feature grid | `FeatureGrid` |
| Integration grid | `IntegrationGrid` |
| Big metrics | `MetricsCallout`, `StatsStrip` |
| Comparison vs competitors | `ComparisonTable` |
| Pricing | `PricingTable` |
| Testimonials | `Testimonials`, `TestimonialWall` |
| Changelog teaser | `ChangelogTimeline` |
| Blog teaser | `Posts` |

**Candidate gaps that Stitch could fill** (likely net-new modules):

1. **Code-snippet hero block** — for API/dev-tool landing, a hero with a
   syntax-highlighted code excerpt next to the headline. Not covered.
2. **Two-column with screenshot + bullet feature list** — common SaaS
   pattern; close to `Hero` + `FeatureGrid` but the side-by-side layout
   isn't a current module.
3. **FAQ accordion** — appears in many SaaS landings; we don't ship one.
4. **Newsletter / waitlist CTA strip** — distinct from generic CTA; pre-launch tool.

**POC scope**: Stitch one of those 4. Suggested target — **FAQ accordion**
because it's the most reusable across themes (every theme needs FAQ)
and lowest risk for a process trial.

## Acceptance for the POC itself

POC succeeds if at the end of one session we have:

- [ ] Stitch prompt that produced usable output (captured here verbatim)
- [ ] Frame screenshot saved under `docs/roadmap/_meta/stitch-artifacts/`
- [ ] One new module landed end-to-end (display + editor + types + registry + scss + e2e baseline + MCP coverage)
- [ ] Process retro — what went well / what to change before scaling to themes 2-5

Once the POC clears, we apply Workflow B to roll
saas-landing's per-theme variants on the existing module set, then
repeat for the other 4 themes.
