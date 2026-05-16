# Stitch prompt — KeyValueDossier (session #1)

Target: `KeyValueDossier` module — replaces hand-typed `<dl><dt><dd>`
patterns currently in `cv-sec-home-vitals` + `cv-sec-home-matrix-platforms`
on funisimo.pro (2026-05-16 audit). Used to render structured fact
tables: definitions, vital stats, contact rows, platform inventories.

## Active theme — editorial

From `services/themes/editorial/theme.json` (verbatim):

- **slug**: `editorial`
- **name**: Editorial
- **tagline**: Warm cream paper, serif display, slow deliberate motion — for writers, photographers, considered portfolios.
- **mood**: quiet, literary, spacious, deliberate, warm
- **palette light**: surface `#FAF7F2`, ink `#1A1814`, accent `#B85C38`, accentInk `#FAF7F2`, surfaceInset `#F2EEE3`, rule `#D8D1BF`
- **typography**: display `'Source Serif Pro', ui-serif, Georgia, serif`,
  body `'Inter', system-ui, sans-serif`, mono `ui-monospace, 'SF Mono', Menlo, monospace`
- **baseSize**: 17px
- **motion**: gentle-slow
- **headerBehavior**: centered-hero-integrated
- **footerLayout**: minimal-1row
- **logoLockup**: wordmark
- **moduleStyleHints**: hero `full-bleed-overlay-nav`, timeline `broken-grid`, posts `editorial`, gallery `magazine-spread`, project-grid `asymmetric`

## Content shape (already verified from live page)

```json
{
  "title": "Optional H4 header — e.g. 'Hero vitals' or 'Platforms · tooling · other'",
  "items": [
    { "label": "Based",  "value": "Sigulda, Latvia (EU)" },
    { "label": "Years",  "value": "15+ in digital" },
    { "label": "Mode",   "value": "Remote-first · Contract or permanent" },
    { "label": "Stack",  "value": "TypeScript · React · Next.js · .NET · gRPC · Claude Code" }
  ]
}
```

Item count varies — current usages have 4 (vitals) up to 8 (platforms).
Value may contain inline middle-dot separators (`·`) for list-of-tokens
phrasing.

## Prompt to send to Gemini (Stitch model)

```
Design a reusable "KeyValueDossier" UI module for a CMS-rendered editorial
portfolio site. Replaces hand-typed <dl><dt><dd> patterns. Renders a
structured fact table where the operator supplies:

  - title?: string (optional H4; omit element if absent)
  - items: Array<{ label: string, value: string, href?: string }>

Visual identity — editorial theme:
  - Mood: quiet, literary, spacious, deliberate, warm
  - Surface #FAF7F2 (warm cream paper), ink #1A1814, accent #B85C38 (warm rust), rule #D8D1BF
  - Display font 'Source Serif Pro', serif
  - Body font 'Inter', sans-serif
  - Mono ui-monospace for labels — feels typewriter-stamped
  - No card, no shadow, no border-radius — hairline rules only
  - Labels uppercase + mono + smaller; values body sans-serif

Layout requirements:
  - Desktop: 2-column grid, label left ~120-160px, value right wraps
  - Tablet: same 2-column, label narrower
  - Mobile: stacked (label on its own line, value below)
  - Optional href on item → underlined link, accent color on hover
  - Optional title → renders above as H4 with hairline rule below

Produce 3 variants in one go:
  1. "editorial" — strict serif + monospace label + hairline rule per row
  2. "tech-modern" — same shape, but for saas-landing theme (dark surface,
     mono label tinted violet #A78BFA, no rules, just spacing)
  3. "card-grid" — denser commerce-theme variant, 3-col grid of mini-cards
     each with label-above + value-below

Output format: ONE HTML document with three <section data-variant="..."> blocks
side-by-side. Inline <style> in the head. Use CSS custom properties for
theme tokens so the variants share structure. No JavaScript. No external
assets. No design-token framework — plain CSS only.

Constraints:
  - Use semantic HTML: <dl><dt><dd> per item (we want screen-readers to
    keep recognising this as a description list)
  - data-testid="key-value-dossier" on the root, data-testid="kv-row" on
    each row
  - All colors as CSS variables in :root so we can swap palettes
```

## Capture once received

Save the response body verbatim as `response.html` in this folder. Then
take three screenshots (one per variant) and save as
`variant-editorial.png` / `variant-tech-modern.png` / `variant-card-grid.png`.

## Next step (Step 4 — Implement)

Once captured, extract:
- Slots → `ui/client/modules/KeyValueDossier/KeyValueDossier.types.ts`
- Layout → `ui/client/modules/KeyValueDossier/KeyValueDossier.tsx` +
  `KeyValueDossier.scss` (cssVar-driven)
- Per-theme styles → `services/themes/{editorial,saas-landing,commerce}/module-styles.scss`
- Editor → `ui/admin/modules/KeyValueDossierEditor.tsx`
- Register: `clientItemTypes.ts` + `adminItemTypeEditors.ts`
- MCP: ensure `page.update` carries the new item type
- e2e baselines: `tests/e2e/visual/modules/displays.spec.ts` + `editors.spec.ts`
- Migration: replace `cv-sec-home-vitals` + `cv-sec-home-matrix-platforms`
  RichText content with the new module on funisimo.pro (via MCP
  `page.update` once the module type ships)
