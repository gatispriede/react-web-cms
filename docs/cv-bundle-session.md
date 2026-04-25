# CV Bundle session — features added

This document captures the modules, styles and bundle changes introduced while
iterating on the four-page CV bundle (`Home` / `Contact` / `CMS` / `LSS`)
backed by `scripts/buildCvBundle.cjs`. Output is written to:

- `public/design-v7/cv-bundle.bundle.json`
- `public/CV/v3/cv-bundle.bundle.json`

## New display modules

### ArchitectureTiers (`EItemType.ArchitectureTiers`)
Replaces the older `SERVICES / tiers` block. Renders, in order:
- editorial header (`eyebrow / title / subtitle / intro`),
- 3-up tier cards each carrying `ord`, `concern`, `role`, `title`,
  `description`, optional `pills[]` and a `modules[]` table with
  right-aligned `tag` column,
- a `shared` footer card (`sharedTitle / sharedDescription / sharedPills`),
- a 7-column lifecycle rail (`lifecycleSteps[]` with `n / title / sub`,
  optional `highlight`).

Files:
- `ui/client/modules/ArchitectureTiers/{ArchitectureTiers.tsx, .types.ts, .scss, index.ts}`
- `ui/admin/modules/ArchitectureTiers/{ArchitectureTiersEditor.tsx, index.ts}`

Wired into `cv-sec-cms-tiers` and `cv-sec-lss-tiers`.

### StatsStrip (`EItemType.StatsStrip`)
Horizontal numeric strip — auto-fit grid of cells:
`{value, unit?, label?, highlight?}`. Lives as its own section under each hero,
peeled out of the previous Hero `coords[]`.

Files:
- `ui/client/modules/StatsStrip/{StatsStrip.tsx, .types.ts, .scss, index.ts}`
- `ui/admin/modules/StatsStrip/{StatsStripEditor.tsx, index.ts}`

Wired into `cv-sec-home-coords`, `cv-sec-cms-stats`, `cv-sec-lss-stats`.

## New styles on existing modules

### `EListStyle.PaperGrid` (`paper-grid`)
4-column editorial card grid for the Dossier "Key technologies" B.01-B.12
layout. Each card: mono-caps `prefix` (B.01 …), display-serif `label`,
optional `meta`, paragraph `value`. Responsive → 2-col → 1-col.

Files: `ui/client/modules/List/{List.tsx, List.types.ts, List.scss}`.
Wired into `cv-sec-cms-stack` and `cv-sec-lss-stack`.

### Capability matrix split — `sec3([2, 1])` rows
Stacked two `type:3` sections with `slots:[2, 1]` so the left two thirds
host the SkillPills matrix and the right third hosts a Languages dl /
Own-work facts list. Mirrors the 60/30 dossier layout while remaining
within the existing slot model (`SectionContent` resolves one item per slot).

### DataModel realignment
`data-model__body` uses `minmax(0, 1.7fr) minmax(240px, 1fr)` with
`align-items: start` and a left-rule on the aside. Collections render as a
2-col bordered card grid rather than a single dashed list.

### RepoTree — collapsable + height-capped
`buildViewTree()` converts the flat `nodes[]` into a nested tree. Only
depth-0 folders are expanded by default; clicking a folder toggles its
children. Tree wrapper and detail panel both cap at
`clamp(320px, 50vh, 480px)` with `overflow-y: auto`.

## Bundle generator helpers (`scripts/buildCvBundle.cjs`)
- `vitalsBlock(metaPairs)` — emits a `<dl class="hero-vitals">` block as a
  RICH_TEXT section, separating identity (Hero) from key/value vitals.
- `statsStrip(coords)` — legacy fallback (RICH_TEXT-rendered horizontal
  strip). Live sections now use the dedicated `STATS_STRIP` item type.
- Repo tree loader factored to take a file path; LSS uses
  `public/CV/v3/repotreedata-lss.js`.

## New section: AI-as-CMS-language pitch
`cv-sec-cms-pitch` — `MANIFESTO` block at the top of the CMS page framing
funisimo as a CMS *built for AI to use as a content language*: small
declarative grammar of pages, sections, items and styles an LLM can author
end-to-end, producing beautiful, complex, fully editable sites within minutes.

## SEO updates
- `site.siteSeo` — title and description now lead with the AI-driven CMS
  positioning; keywords add `ai cms`, `ai content authoring`, `llm cms`,
  `schema-first cms`, `headless cms`.
- `cv-nav-cms.seo` — title/description/keywords reframed around
  "Built for AI · A content language for LLMs · Case study".

## Registry / enum / schema additions
- `EItemType.ArchitectureTiers`, `EItemType.StatsStrip`
  (`shared/enums/EItemType.ts`).
- Loose object validators in `shared/utils/contentSchemas.ts`.
- Two new entries in `ui/admin/lib/itemTypes/registry.ts` paired with
  display + editor imports.
- New SCSS imports in `ui/client/styles/globals/global.scss`:
  `@use "../../modules/ArchitectureTiers/ArchitectureTiers";` and
  `@use "../../modules/StatsStrip/StatsStrip";`.

## Hero clean-up
Hero items no longer carry `meta` / `coords`. Each page now has a dedicated
vitals `<dl>` section (rendered via `vitalsBlock()`) and a dedicated
`STATS_STRIP` section as siblings of the Hero. Hero stays purely about
identity (eyebrow, name, lede, CTA, portrait).
