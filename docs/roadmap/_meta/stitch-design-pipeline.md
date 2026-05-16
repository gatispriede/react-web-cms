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
> When operators repeatedly write `<RichText>` blocks to describe
> structured content (key-value dossier, section heading + subtitle,
> definition list of platforms / specs / hours), that's a signal to
> ship a **module** for that shape, not document a "how to write good
> rich text" guide. Stitch is the fastest way to design the visual side
> of those modules — especially across the 5 remaining themes.
>
> `<RichText>` is the fallback for genuine prose (blog body, long-form
> policy text). Not the default for structured content.

## The 6-step process

```
0. Audit  →  1. Capture  →  2. Theme  →  3. Stitch  →  4. Implement  →  5. Bake in
```

### Step 0 — Audit: find the candidate

Pick a CMS area that is **manually styled** (raw HTML in RichText / inline
SCSS classes) or **lacking style** (unstyled fallback).

Tooling — use the local MCP `page.list` + `page.get` to walk live
production pages, NOT just dev fixtures. Look for:

- `type: "RICH_TEXT"` entries doing structured-content jobs (dl/dt/dd
  tables, section headings with eyebrows, fact lists)
- The same HTML pattern repeated across 3+ pages → strong reuse signal
- Custom CSS classes baked into the RichText body (e.g. `class="hero-vitals"`)
  → operator already wishes a module existed
- Sections rendered visually plain compared to their theme's `moduleStyleHints`

Example audit query (run early in the session):

```
mcp__funisimo-prod__page_list      # list every page
mcp__funisimo-prod__page_get       # walk sections of the candidate page
```

Capture the shape you're seeing — name the implicit module the operator
keeps reinventing. Stitch will design *that*, not the page.

### Step 1 — Capture: ground Stitch in the current state

Two artefacts, both go into `docs/roadmap/_meta/design-artifacts/<module-name>/`:

| Artefact | Source | Purpose |
|----------|--------|---------|
| `before.png` | `tests/e2e/visual/surfaces.spec.ts-snapshots/` or fresh `playwright test --update-snapshots` | Stitch sees the current look — anchors its variants to *this* site, not generic SaaS |
| `before.html` | Inspector → "Copy outerHTML" of the section | Stitch sees the literal markup it's replacing — surfaces hardcoded styling |

If no e2e snapshot exists for that surface, **add one to surfaces.spec.ts**
in the same PR. The visual regression baseline serves the next pass too.

### Step 2 — Theme: feed Stitch the design system, not vibes

Pull the active theme description from
`services/themes/<slug>/theme.json` and include verbatim in the prompt.
If the theme has no description, **author one before Stitching** —
otherwise every frame is generic.

Required fields the prompt must carry:

| Field | Source | Example (saas-landing) |
|-------|--------|------------------------|
| `slug` | `theme.json` | `saas-landing` |
| `mood` | `theme.json` | tech-modern, confident, sharp, gradient-aware |
| `palette` | `theme.json` | surface `#0F172A` (dark) · accent `#7C3AED` violet |
| `typography` | `theme.json` | display Mona Sans, body Inter, mono JetBrains Mono |
| Existing `moduleStyleHints` | `theme.json` | `featureGrid: icon-on-gradient-tile` |
| Theme description | `services/themes/<slug>/README.md` if present | one-paragraph identity |

If a field is missing — author it in `theme.json` before Stitching, commit
that as Step 0.5. The theme files are the source of truth; Stitch is a
downstream consumer.

### Step 3 — Stitch: the prompt

Standard prompt skeleton:

```
Design a [module name] for a CMS that renders [content shape, e.g. a
key-value dossier of 4–8 stat pairs, label left/value right, monospace
labels, no surrounding card]. The active theme is "[slug]" — [mood].
Palette: surface [hex], ink [hex], accent [hex]. Typography: display
[font], body [font]. Behave like an editorial dossier — restrained,
typographic, rules over chrome.

Slots (operator-filled):
  - title: string (optional, omit when absent)
  - items: array of {label: string, value: string, href?: string}

Variants to produce: 3 — one strict-editorial, one tech-modern, one
brutalist-minimal. Each should fit a 1-column desktop block at 720 px
content width; mobile stacks.

Output: HTML + CSS (inline-styles or single class block). No JS, no
external assets, no design-token frameworks beyond CSS variables.
```

Two non-negotiables in the prompt:

- **Slot list explicit** — Stitch will invent fields otherwise; we want
  to feed the form designer back at Step 4 with a fixed shape.
- **Output format named** — HTML+CSS gives the cleanest extraction;
  React export is fine but Stitch often hardcodes Tailwind that we
  have to strip.

### Step 4 — Implement: frame → typed module

Standard skeleton:

```
ui/client/modules/<Name>/
  <Name>.tsx          # display — Server-safe by default; "use client" only if interactive
  <Name>.types.ts     # I<Name> interface + parseContent()
  <Name>.scss         # cssVar-driven; import in pages/_app.tsx (RSC rule)
  index.ts            # re-export
ui/admin/modules/<Name>Editor.tsx   # form, mirror of <Name>.types
```

Three extractions, in order:

| Output of Stitch | Where it lands |
|------------------|----------------|
| Slots (operator-fillable bits) | `<Module>.types.ts` → `I<Module>` interface |
| Layout (grid/stack/columns/spacing) | `<Module>.tsx` JSX + `.scss` |
| Visual tokens (color/type/radius/shadow) | `services/themes/<theme>/theme.json` palette / `moduleStyleHints` — **never hardcoded in the module** |

Register both halves:

- `ui/client/modules/clientItemTypes.ts` → display
- `ui/admin/modules/adminItemTypeEditors.ts` → editor

### Step 5 — Bake in: meet the universal requirements

Non-negotiable per [README.md](../README.md) §Universal requirements:

- [ ] MCP coverage — module shape authorable via `page.update` / `section.update`
- [ ] `data-testid` on every interactive surface (admin editor especially)
- [ ] Visual baseline entries in `tests/e2e/visual/modules/displays.spec.ts` + `editors.spec.ts`
- [ ] Migration of existing RichText usages → new module (search for the HTML pattern; emit a one-off migration script if 3+ pages affected)
- [ ] Theme `moduleStyleHints` updated if the module has a per-theme look
- [ ] Module catalogue (`_meta/new-modules-catalogue.md`) updated

## When to reach for Stitch — decision tree

```
Operator content has predictable structure?
├── NO  → keep as <RichText>
└── YES → Does an existing module + variant cover it?
         ├── YES → use it; don't Stitch
         └── NO  → Is this a brand-new shape, or a theme-specific look on an existing one?
                  ├── shape   → Stitch a new module (Workflow above)
                  └── variant → Stitch theme frames (Workflow B below)
```

**Don't reach for Stitch when:**
- The change is logic-only (validation rule, MCP tool, routing)
- An existing module's `moduleStyleHints` already nails it
- Backend / infra / migration work (app-router, dropship adapter, RSC fixes)
- Operator one-off content — they get modules, not Stitch

## Workflow B — Stitch theme frames → existing modules, new look

For the 5 themes pending Stitch design (`local-business`, `saas-landing`,
`portfolio`, `agency`, `commerce`):

1. Stitch produces frames per theme — one per critical surface (homepage hero, pricing, features, footer).
2. Compare each frame against existing module set:
   - Existing module + cssVar token tweak ✅ — best outcome, no code change
   - Existing module + new theme-specific SCSS hook ⚠️ — add a `data-theme="<slug>"` SCSS branch
   - New module needed ❌ — fall back to the 6-step process above
3. Capture deltas in theme files only:

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
| **"Audit a live page for Stitch candidates"** | Run `mcp__funisimo-prod__page_list` + `page_get`, surface the RichText-doing-structured-work entries, propose modules |

If Stitch output drifts from our design system (hardcoded colors, custom
spacings outside the type scale, novel components for shapes we already
have), I push back rather than land it as-is.

## Live audit — Home page (funisimo.pro), 2026-05-16

Run through Step 0 against `cv-nav-home`. The page ships 11 sections;
6 of them are `RICH_TEXT` doing structured-content jobs an operator
shouldn't have to author as HTML. Three distinct shapes recurring:

### Candidate 1 — `KeyValueDossier`

**Live usages**: `cv-sec-home-vitals`, `cv-sec-home-matrix-platforms`,
section heads § 01 / § 02 / § 03 subtitles.

Current operator authoring:

```html
<dl class="hero-vitals">
  <dt>Based</dt><dd>Sigulda, Latvia (EU)</dd>
  <dt>Years</dt><dd>15+ in digital</dd>
  <dt>Mode</dt><dd>Remote-first · Contract or permanent</dd>
  <dt>Stack</dt><dd>TypeScript · React · Next.js · .NET · gRPC · Claude Code</dd>
</dl>
```

**Pain**: operator hand-types `<dl><dt><dd>`. CSS class `hero-vitals`
hardcoded. Same shape on platforms list with 8 rows. No reuse — every
new dossier section is a fresh paste.

**Proposed module**: `KeyValueDossier`

- Slots: `title?: string`, `items: Array<{label: string, value: string, href?: string}>`
- Variants: `editorial` (current look, monospace labels), `tech-modern` (saas-landing variant), `card-grid` (commerce variant)
- Stitch input: existing `cv-sec-home-vitals` screenshot + theme description for the 5 pending themes

### Candidate 2 — `SectionHeading`

**Live usages**: `cv-sec-home-matrix-head`, `cv-sec-home-career-head`,
`cv-sec-home-dossier-head`.

Current operator authoring:

```html
<h2>§ 01 · Capability matrix</h2>
<p><em>Self-reported · 0–10 scale</em></p>
```

**Pain**: section numbering (`§ 01`) is convention-driven and would be
auto-generated in a real module. Subtitle italic is presentational.

**Proposed module**: `SectionHeading`

- Slots: `eyebrow?: string` (`§ 01`), `heading: string`, `subtitle?: string`, `align?: 'left' | 'center'`
- Variants: `editorial` (current `§ NN` + italic subtitle), `tech-modern` (no §, accent-colored eyebrow), `restaurant` (script font subtitle)

### Candidate 3 — Reuse existing modules

The hero is already typed (`HERO` module, `editorial` style). The
career timeline is already typed (`TIMELINE` `editorial`). The capability
matrix is already typed (`SKILL_PILLS` `matrix`). These don't need Stitch;
they need per-theme variants when other themes get a design pass.

## POC candidate — `KeyValueDossier` first

Smallest reusable shape with the highest active footprint (2 home-page
sections, would migrate to contact + CMS + LSS pages). Stitch it, ship
it end-to-end, run the retro, then move to `SectionHeading`.

### POC acceptance

- [ ] Stitch prompt captured verbatim in this doc (Stitch session #1)
- [ ] Frame screenshots saved under `docs/roadmap/_meta/design-artifacts/key-value-dossier/`
- [ ] `KeyValueDossier` module landed end-to-end (display + editor + types + registry + scss + e2e baseline + MCP coverage + migration of `cv-sec-home-vitals` + `cv-sec-home-matrix-platforms`)
- [ ] Process retro — what went well / what to change before the next module
