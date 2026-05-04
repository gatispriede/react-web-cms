# `StatsCard` (`EItemType.StatsCard`)

> A pill-tagged card with a 2-column stat grid (big number + label) and an optional checklist of features. "15+ years in digital" / "200+ projects" type displays.

`item.type`: `STATS_CARD` &nbsp;·&nbsp; `item.style`: `default` (one of [`EStatsCardStyle`](../../ui/client/modules/StatsCard/StatsCard.types.ts))

---

## Content shape

```ts
{
    tag?: string;                      // small pill above the title (e.g. "SUMMARY")
    title?: string;                    // card heading
    stats: IStatsCardStat[];           // big number + label pairs (rendered 2-col)
    features?: IStatsCardFeature[];    // optional checklist below the stats
}

interface IStatsCardStat {
    value: string;                     // big accent number (e.g. "15+", "$2.4M")
    label: string;                     // small mono label below
}

interface IStatsCardFeature {
    text: string;                      // single-line bullet
}
```

## Styles

| Value | Description |
|---|---|
| `default` | Standard card |
| `panel` | Industrial — dark panel, yellow accent rule on the left |

Source: `EStatsCardStyle` enum in [`StatsCard.types.ts`](../../ui/client/modules/StatsCard/StatsCard.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/StatsCard/StatsCardEditor.tsx`](../../ui/admin/modules/StatsCard/StatsCardEditor.tsx)

Top-level:

- **Tag** — `<Input>` placeholder `SUMMARY`
- **Title** — `<Input>` placeholder `15+ years in digital`

**Stats** (sortable):

- Per stat: Value `<Input>` (width 110), Label `<Input>` (width 260) &nbsp;·&nbsp; **first stat's Label** carries `data-testid="module-editor-primary-text-input"`
- **Add stat** button. Hint: "Renders in a 2-column grid — add in pairs for an even layout."

**Features (checklist)** (sortable):

- Per feature: Text `<Input>` (width 420), delete button
- **Add feature** button.

## Public rendering

**File:** [`ui/client/modules/StatsCard/StatsCard.tsx`](../../ui/client/modules/StatsCard/StatsCard.tsx)

```html
<div class="stats-card default">
    <div class="stats-card__tag">{tag}</div>
    <h3 class="stats-card__title">{title}</h3>
    <div class="stats-card__grid">
        <div class="stats-card__stat">
            <div class="stats-card__n">{stat.value}</div>
            <div class="stats-card__l">{stat.label}</div>
        </div>
        <!-- more -->
    </div>
    <ul class="stats-card__features">
        <li>{feature.text}</li>
    </ul>
</div>
```

The whole card is wrapped in `<RevealOnScroll>`. The `<h3>` gets an `id` from `slugifyAnchor()` for deep-link anchors.

**Theming tokens consumed (StatsCard.scss):** `--token-color-accent` (big numbers, checkmark glyph), surface / border tokens.

**Italic-accent runs (`*word*`):** NOT supported.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-stats-card` |
| Rendered module container (admin + public) | `section-module-row-stats-card` |
| Edit affordance on the section row (admin) | `section-module-edit-stats-card-btn` |
| Primary text input (admin) | `module-editor-primary-text-input` (on the **first stat's** Label) |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.StatsCard,
    style: 'default',
    content: {
        stats: [{value: '42', label: m(EItemType.StatsCard)}],
    },
    markerText: m(EItemType.StatsCard),
}
```

---

## MCP commands

```bash
cms section add my-page STATS_CARD --sample
cms section add my-page STATS_CARD --content '{"tag":"SUMMARY","title":"15+ years","stats":[{"value":"15+","label":"years"},{"value":"200+","label":"projects"}],"features":[{"text":"ISO-compliant delivery"}]}'
cms section update <id> --style panel
```

---

## Notes

- The 2-col grid is best populated in pairs — odd counts work but render with an empty last cell.
- See [`stats-strip.md`](stats-strip.md) for a horizontal-row variant (3–6 cells) and [`list.md`](list.md) for `facts` style if you want key/value pairs without big-number emphasis.
