# `List` (`EItemType.List`)

> Generic key/value list, with five visual modes driven by `item.style`: bulleted, dossier facts, inline chips, project case-cards, or paper-grid editorial cards.

`item.type`: `LIST` &nbsp;·&nbsp; `item.style`: `default` (one of [`EListStyle`](../../ui/client/modules/List/List.types.ts))

---

## Content shape

```ts
{
    title?: string;                    // optional list heading
    items: IListItem[];
}

interface IListItem {
    label: string;                     // required — primary label
    value?: string;                    // secondary value / description
    href?: string;                     // makes value a link
    prefix?: string;                   // accent prefix above the title (cases mode, e.g. "2024")
    prefixSub?: string;                // small sub-prefix (cases mode, e.g. "— TAGAD")
    meta?: string;                     // small mono/caps sub-label under the title
    tags?: string[];                   // chip row under the description (cases mode)
}
```

## Styles

| Value | Description |
|---|---|
| `default` | Bulleted list — label · value lines |
| `facts` | Editorial key/value — mono-caps label left, value right, dashed rules (Dossier Contact / Signals) |
| `inline` | Flex row of label+value chips |
| `cases` | 2-col project / case-card grid (Industrial); uses `prefix`, `prefixSub`, `meta`, `tags` |
| `paper-grid` | 4-col grid of editorial paper cards — mono-caps prefix top-left, label, value paragraph (Dossier "Key technologies" B.01-B.12) |

Source: `EListStyle` enum in [`List.types.ts`](../../ui/client/modules/List/List.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/List/ListEditor.tsx`](../../ui/admin/modules/List/ListEditor.tsx)

The editor only shapes the data — visual mode is picked on the Style tab.

Top-level:

- **Title** — `<Input>` placeholder `Contact`

Each item (sortable, drag handle):

- **Label** — `<Input>` (width 140) &nbsp;·&nbsp; **first item only** carries `data-testid="module-editor-primary-text-input"`
- **Value** — `<Input>` (flex)
- **Link (optional)** — `<LinkTargetPicker>` (width 220)
- Delete button

Top-level: **Add list item** button (dashed, full-width).

The editor does not currently expose `prefix`, `prefixSub`, `meta`, or `tags` (only used by `cases` / `paper-grid` styles) — author those via MCP `section update --content` or by editing the bundle JSON directly.

## Public rendering

**File:** [`ui/client/modules/List/List.tsx`](../../ui/client/modules/List/List.tsx)

Default markup:

```html
<div class="list-module default">
    <div class="list-module__title">{title}</div>
    <ul class="list-module__items">
        <li>
            <span class="list-module__label">{label}</span>
            <span class="list-module__value">
                <a href="{href}">{value}</a>
            </span>
        </li>
    </ul>
</div>
```

Facts mode renders `<dl class="list-module__facts">` with `<dt>{label}</dt><dd>{value or <a>}</dd>` rows.

Cases mode renders 2-col cards with `<a class="list-module__case">` wrappers when `href` is set, plus prefix / meta / desc / tags markup.

Paper-grid mode renders 4-col cards with `<div class="list-module__pg-ord">{prefix or padded index}</div>` headers.

The whole module is wrapped in `<RevealOnScroll>`. Title gets an anchor `id` from `slugifyAnchor`.

**Theming tokens consumed (List.scss):** typography tokens, `--token-color-accent` (case prefix, paper-grid ord), border / surface tokens.

**Italic-accent runs (`*word*`):** NOT supported.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-list` |
| Rendered module container (admin + public) | `section-module-row-list` |
| Edit affordance on the section row (admin) | `section-module-edit-list-btn` |
| Primary text input (admin) | `module-editor-primary-text-input` (on the **first item's** Label) |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.List,
    style: 'default',
    content: {
        items: [{label: m(EItemType.List)}],
    },
    markerText: m(EItemType.List),
}
```

---

## MCP commands

```bash
cms section add my-page LIST --sample
cms section add my-page LIST --content '{"title":"Contact","items":[{"label":"Email","value":"hi@example.com","href":"mailto:hi@example.com"}]}'
cms section update <id> --style facts
```

---

## Notes

- `cases` and `paper-grid` styles use additional fields (`prefix`, `prefixSub`, `meta`, `tags`) that the admin editor doesn't surface today. If you author via MCP and later open in the admin, those fields are preserved (the editor only writes the fields it knows about).
- See [`stats-card.md`](stats-card.md) for big-number stat displays and [`stats-strip.md`](stats-strip.md) for horizontal stat strips.
