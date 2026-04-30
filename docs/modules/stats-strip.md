# `StatsStrip` (`EItemType.StatsStrip`)

> Horizontal row of stat cells — big value with optional unit, label below. The band that sits between a hero and the first content section on the v2 paper dossiers. Dev-portfolio specific.

`item.type`: `STATS_STRIP` &nbsp;·&nbsp; `item.style`: `default` (one of [`EStatsStripStyle`](../../ui/client/modules/StatsStrip/StatsStrip.types.ts))

---

## Content shape

```ts
{
    cells: IStatsStripCell[];
}

interface IStatsStripCell {
    value: string;                     // big numeric value (e.g. "17", "$13")
    unit?: string;                     // small inline unit suffix (e.g. "types", "$/mo")
    label?: string;                    // caption below the value
    highlight?: boolean;               // accent-fill on the cell
}
```

## Styles

| Value | Description |
|---|---|
| `default` | Standard horizontal strip |
| `editorial` | Paper / editorial CV variant |

Source: `EStatsStripStyle` enum in [`StatsStrip.types.ts`](../../ui/client/modules/StatsStrip/StatsStrip.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/StatsStrip/StatsStripEditor.tsx`](../../ui/admin/modules/StatsStrip/StatsStripEditor.tsx)

The editor renders a flat row of cell rows (no top-level fields):

- Per cell: value (`<Input>` width 80, placeholder `17`), unit (`<Input>` width 110, placeholder `types`), label (`<Input>` width 240, placeholder `reusable item types`), highlight (`<Switch>` checkedChildren `HL` / unCheckedChildren `—`), delete button
- **Add stat** button (dashed, full-width)

**No `module-editor-primary-text-input`** — registry-omitted, dev-portfolio specific.

## Public rendering

**File:** [`ui/client/modules/StatsStrip/StatsStrip.tsx`](../../ui/client/modules/StatsStrip/StatsStrip.tsx)

```html
<div class="stats-strip default">
    <div class="stats-strip__row">
        <div class="stats-strip__cell is-hl?">
            <div class="stats-strip__v">{value}<span class="stats-strip__unit">{unit}</span></div>
            <div class="stats-strip__k">{label}</div>
        </div>
        <!-- more cells -->
    </div>
</div>
```

When `cells` is empty, the component renders `null` (no empty row).

Wrapped in `<RevealOnScroll>`.

**Theming tokens consumed (StatsStrip.scss):** big number typography, accent (highlight cell), divider rule between cells.

**Italic-accent runs (`*word*`):** NOT supported.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-stats-strip` |
| Rendered module container (admin + public) | `section-module-row-stats-strip` |
| Edit affordance on the section row (admin) | `section-module-edit-stats-strip-btn` |
| Primary text input (admin) | **not surfaced** — registry-omitted |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

**Omitted from the registry.** Reason: dev-portfolio specific. `REGISTRY_OMISSIONS` in `moduleSamples.ts` lists `EItemType.StatsStrip`.

---

## MCP commands

```bash
cms section add my-page STATS_STRIP --content '{"cells":[{"value":"17","unit":"types","label":"reusable item types"},{"value":"10","unit":"cols","label":"section cols"},{"value":"8","unit":"themes","label":"design themes"},{"value":"~13","unit":"$/mo","label":"hosting","highlight":true},{"value":"60","unit":"s","label":"first deploy"}]}'
cms section update <id> --style editorial
```

---

## Notes

- 3–6 cells is the sweet spot. More than 6 wraps onto a second row at narrow viewports and loses the "strip" feel.
- The `value` is rendered verbatim (no number formatting). Pass formatted strings (`"~13"`, `"$2.4M"`, `"99.9%"`).
- See [`stats-card.md`](stats-card.md) for the card-with-stats variant (vertical 2-col grid + optional checklist) — pick StatsCard inside content, StatsStrip as a section divider.
- Dev-portfolio-specific module — used in v2 paper dossiers (Portfolio.html / Portfolio - CMS.html / LSS).
