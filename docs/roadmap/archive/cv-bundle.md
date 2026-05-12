# CV Bundle (Dossier / Contact / CMS)

Goal: ship 3 CMS pages mirroring `public/CV/v2/Portfolio*.html` as closely as the
existing module catalogue allows, adding new style variants where one is close,
and net-new modules only where the functionality genuinely doesn't exist yet.

Source designs:
- `public/CV/v2/Portfolio.html`           → **Dossier**
- `public/CV/v2/Portfolio - Contact.html` → **Contact**
- `public/CV/v2/Portfolio - CMS.html`     → **CMS** (case study)

## Section → module mapping

### Dossier (`/`)
| Section in HTML | Module | Notes |
|---|---|---|
| Hero (nameblock + portrait + hero-meta dl + coords strip) | `Hero` (existing) | already supports `eyebrow` / `headlineSoft` / `titles` / `meta` / `coords` / `portrait*`. Use `EHeroStyle.Editorial`. |
| Capability matrix (skill bars 0–10) | `SkillPills` (existing) | `ESkillPillsStyle.Matrix`. |
| Languages table | `SkillPills` (existing) | `Matrix` again with score% — drop in as a second SkillPills item. |
| Own work entries | `List` (existing) | `EListStyle.Cases`. |
| Career timeline (expandable role + experience-in + key achievements + quote) | `Timeline` (existing) | `ETimelineStyle.Editorial`. |
| Closing strip — 3 chapter cards | `Services` (existing) | `EServicesStyle.Cards`. |
| Facts list (k/v) | `List` (existing) | `EListStyle.Facts`. |

→ **Zero new modules** for Dossier.

### Contact (`/contact`)
| Section in HTML | Module | Notes |
|---|---|---|
| Hero | `Hero` (existing) | `Editorial`. |
| Inquiry form (topic chips + name/email/company/message/submit) | **NEW: `InquiryForm`** | submits to GraphQL `submitInquiry` mutation; topic preselection is purely UI. |
| Channels strip (5 link cards: GitHub / LinkedIn / Email / Phone / Calendar) | `SocialLinks` (existing) + new style | add `ESocialLinksStyle.Channels` — card grid with platform glyph, label, big href, mono "OPEN" affordance. |
| Education list | `Timeline` (existing) | `ETimelineStyle.Minimal`. |
| Working preferences / Signals & interests | `List` (existing) | `EListStyle.Facts`. |

→ **1 new module + 1 new style.**

### CMS (`/cms`)
| Section in HTML | Module | Notes |
|---|---|---|
| Hero (vitals + "screen-card" placeholder) | `Hero` (existing) | `Editorial`; the screen-card maps to `portraitImage` if real, otherwise the diagonal placeholder. |
| Stats strip (5 cells) | `StatsCard` (existing) | render multiple stats in `default` style. |
| Architecture — 3 tier cards + flow rail | `Services` (existing) + new style | add `EServicesStyle.Tiers` — wider columns, accent rule top, optional small "FLOW →" caption between cards via `sectionSubtitle`. |
| Stack grid (12 cells, per-cell category) | `SkillPills` (existing) | `ESkillPillsStyle.StackGrid`. |
| Data model (table + side panel + audit cards) | **NEW: `DataModel`** | renders a fields table (name / type / nullable / notes), an aside (collections list), and a 3-up audit card row. |
| Infrastructure (2 droplet cards + SVG topology) | **NEW: `InfraTopology`** | each droplet = card with role / specs / services list; topology is an inline SVG authored as a string field. |
| Repository tree (interactive) | **NEW: `RepoTree`** | list of nodes (path, kind=dir/file, summary); selecting a node reveals its detail pane on the right. |
| CI/CD pipeline | **NEW: `PipelineFlow`** | linear node list (label / status / notes), arrows between, optional side notes column. |
| Closing 3-column notes | `Services` (existing) | `EServicesStyle.Cards`. |

→ **4 new modules + 1 new style.**

## Net-new module checklist

For each new module the contract is the same five-file layout established in
the existing modules:

```
ui/client/modules/<Name>/
  <Name>.tsx         # SSR render, ContentManager subclass
  <Name>.types.ts    # I<Name>, E<Name>Style, sub-interfaces
  <Name>.scss        # base layout; theme overrides live in theme scss
  <Name>.test.tsx    # rendering smoke + a11y check
  index.ts           # default export + named ContentManager + types

ui/admin/modules/<Name>/
  <Name>Editor.tsx   # admin form wired to ContentManager.setField
  index.ts
```

Plus:

- `shared/enums/EItemType.ts` — append `<Name> = "<NAME>"`.
- `ui/client/modules/index.ts` — register render component.
- `ui/admin/modules/index.ts` — register editor.
- Theme scss in `ui/client/themes/*` — at minimum the default editorial
  "paper" variant that matches the CV mockup; other themes can opt-in.

### New modules
1. **`InquiryForm`** — Contact page form. Topic chip group (radio-style),
   text fields, textarea, submit button. Backend: a `submitInquiry`
   mutation that writes to a `Inquiries` mongo collection (separate
   roadmap item — start with a no-op submit + console.log).
2. **`DataModel`** — table-driven schema visualiser. Sub-types:
   `IDataModelField { name, type, nullable, notes }`,
   `IDataModelCollection { name, count? }`,
   `IDataModelAudit { title, body }`.
3. **`InfraTopology`** — droplet cards + free-form inline SVG block.
   Sub-types: `IInfraDroplet { name, role, specs[], services[] }`,
   plus `topologySvg: string` (sanitised through DOMPurify on render).
4. **`RepoTree`** — interactive tree. Sub-type
   `IRepoNode { path, kind: 'dir'|'file', summary, body? }`.
   Initial render has the first file selected; client-side state swaps
   the detail pane.
5. **`PipelineFlow`** — `IPipelineStep { label, status, notes? }`,
   plus optional `sideNotes: string[]`.

### New style variants on existing modules
- `EHeroStyle.Editorial` — already present, just used.
- `ESkillPillsStyle.Matrix`, `StackGrid` — already present.
- `EListStyle.Facts`, `Cases` — already present.
- `EServicesStyle.Cards` — already present.
- `EServicesStyle.Tiers` (NEW) — for CMS Architecture.
- `ESocialLinksStyle.Channels` (NEW) — for Contact channels strip.
- `ETimelineStyle.Editorial`, `Minimal` — already present.

## Page wiring

Each page is a Mongo `Pages` document with a `sections: IItem[]` array. The
seeding lives in `services/seed/cvBundle.ts` (NEW) and runs once via the
existing seed bootstrap path. Routes:

- `/`        — already the index page; replace its default seed with the
               Dossier section list.
- `/contact` — new navigation entry (page slug `contact`).
- `/cms`     — new navigation entry (page slug `cms`).

Translations: each user-facing string lands in the `app` namespace — copy
the keys from the source HTML into `ui/client/public/locales/en/app.json`
on the first pass; other locales can be pulled in via the inline editor.

## Order of work
1. Style variants first — quick wins, no enum/registration churn.
   `ESocialLinksStyle.Channels`, `EServicesStyle.Tiers`.
2. New modules in dependency order:
   `InquiryForm` → `DataModel` → `InfraTopology` → `PipelineFlow` → `RepoTree`.
3. Seed `cvBundle.ts` and wire navigation.
4. Theme scss tuning to bring the editorial paper variant into pixel
   parity with the source.

## Out of scope
- Real `submitInquiry` backend (Inquiries collection, admin inbox view) —
  separate roadmap doc.
- App Router migration — see `app-router-migration.md`.
- Building a generic SVG-author UI for `InfraTopology` — admins paste raw
  SVG for now.
