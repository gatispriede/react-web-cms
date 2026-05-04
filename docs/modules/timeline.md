# `Timeline` (`EItemType.Timeline`)

> Vertical work / education history. Each entry has a period, company, role, and an optional expandable detail panel with experience and achievement bullets.

`item.type`: `TIMELINE` &nbsp;·&nbsp; `item.style`: `default` (one of [`ETimelineStyle`](../../ui/client/modules/Timeline/Timeline.types.ts))

---

## Content shape

```ts
{
    entries: ITimelineEntry[];
}

interface ITimelineEntry {
    start: string;                     // required — period start ("2024-01" / "2024")
    end: string;                       // required — period end ("present" or year/date)
    company: string;                   // required — company name
    role: string;                      // required — job title
    location?: string;                 // small caption next to the period
    domain?: string;                   // website domain shown after the company (e.g. "scichart.com")
    contractType?: string;             // "Contract" / "Permanent" / etc. — appended after the role
    experience?: string[];             // bullets in the "Experience in" detail block
    achievements?: string[];           // bullets in the "Key achievements" detail block
    quote?: string;                    // optional pull-quote at the bottom of the detail panel
    experienceTitle?: string;          // override the "Experience in" heading (per entry)
    achievementsTitle?: string;        // override the "Key achievements" heading
}
```

Full type at [`Timeline.types.ts`](../../ui/client/modules/Timeline/Timeline.types.ts).

## Styles

| Value | Description |
|---|---|
| `default` | Standard left-period column + body |
| `alternating` | Entries alternate left/right of a centred spine |
| `editorial` | Magazine-style spacing, larger period labels |
| `minimal` | Collapses the left period column — period appears inline (used by Dossier "Education") |

Source: `ETimelineStyle` enum in [`Timeline.types.ts`](../../ui/client/modules/Timeline/Timeline.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/Timeline/TimelineEditor.tsx`](../../ui/admin/modules/Timeline/TimelineEditor.tsx)

The editor renders one antd `<Card>` per entry. Sortable by drag handle. Per entry:

- **Start** — `<Input>` placeholder `2024-01`
- **End** — `<Input>` placeholder `present`
- **Company** — `<Input>` &nbsp;·&nbsp; **first entry only** carries `data-testid="module-editor-primary-text-input"`
- **Role** — `<Input>`
- **Domain / website (optional)** — `<Input>`
- **Contract type (optional)** — `<Input>`
- **Detail panel (optional)** — collapsible:
  - Experience section title — placeholder `Experience in`
  - Achievements section title — placeholder `Key achievements`
  - Experience bullets — antd `<Select mode="tags">` with `\n` separator
  - Achievements bullets — same
  - Pull quote — `<TextArea>`
- **More options** — collapsible: Location

Top-level: **Add entry** button. Each entry has a delete button.

## Public rendering

**File:** [`ui/client/modules/Timeline/Timeline.tsx`](../../ui/client/modules/Timeline/Timeline.tsx)

HTML structure (simplified):

```html
<div class="timeline default">
    <div class="timeline__entry">
        <div class="timeline__when">{start} — {end} <span class="timeline__location">{location}</span></div>
        <div class="timeline__body">
            <h3 class="timeline__who">{company} <span class="timeline__domain">{domain}</span></h3>
            <div class="timeline__role"><b>{role}</b> · {contractType}</div>
            <div class="timeline__detail">
                <div class="timeline__detail-grid">
                    <div><h5>{experienceTitle}</h5><ul>{experience...}</ul></div>
                    <div><h5>{achievementsTitle}</h5><ul>{achievements...}</ul></div>
                    <div class="timeline__quote">"{quote}"</div>
                </div>
            </div>
        </div>
    </div>
    <!-- ...more entries -->
</div>
```

Each entry is wrapped in `<RevealOnScroll>` with a staggered delay (`i * 80ms`).

**Theming tokens consumed (Timeline.scss):** typography + accent tokens from the active theme. Period column width / spine accents driven by `--token-color-accent` and rhythm tokens.

**Italic-accent runs (`*word*`):** NOT processed — fields render via `<InlineTranslatable>` only.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-timeline` |
| Rendered module container (admin + public) | `section-module-row-timeline` |
| Edit affordance on the section row (admin) | `section-module-edit-timeline-btn` |
| Primary text input (admin) | `module-editor-primary-text-input` (on the **first entry's** Company input) |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.Timeline,
    style: 'default',
    content: {
        entries: [
            {
                start: '2024',
                end: '2025',
                company: m(EItemType.Timeline),
                role: 'sample role',
            },
        ],
    },
    markerText: m(EItemType.Timeline),
}
```

---

## MCP commands

```bash
cms section add my-page TIMELINE --sample
cms section add my-page TIMELINE --content '{"entries":[{"start":"2024","end":"present","company":"Acme","role":"Eng"}]}'
cms section update <id> --style alternating
```

`cms module describe TIMELINE` returns the content schema + style enum + sample as JSON.

---

## Notes

- The **first entry's Company** is the testid carrier — adding/removing entries doesn't shift the marker because the editor explicitly checks `i === 0`.
- `experienceTitle` / `achievementsTitle` are recent (2026-04-20) — older bundles without them fall back to the translated `"Experience in"` / `"Key achievements"` defaults.
- A timeline entry with no `experience`, `achievements`, or `quote` skips the detail panel entirely (the `hasDetail` boolean gates it).
