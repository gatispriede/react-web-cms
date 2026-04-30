# `SkillPills` (`EItemType.SkillPills`)

> A category-grouped list of skills, rendered three different ways depending on `item.style` — pill tags, animated capability matrix, or 6-column tech-stack grid.

`item.type`: `SKILL_PILLS` &nbsp;·&nbsp; `item.style`: `default` (one of [`ESkillPillsStyle`](../../ui/client/modules/SkillPills/SkillPills.types.ts))

---

## Content shape

```ts
{
    category: string;                  // group label, e.g. "Frontend"
    categoryMeta?: string;             // small subtitle, e.g. "08 entries"
    items: Array<string | ISkillPillItem>;
}

interface ISkillPillItem {
    label: string;                     // pill / matrix / cell label
    score?: number;                    // 0–10 — drives matrix bar width + displayed value
    category?: string;                 // per-item category label (stack-grid mode)
    featured?: boolean;                // accent highlight in matrix / stack-grid
}
```

Items are heterogeneous: a string is treated as `{label}`, an object exposes `score` / `category` / `featured`. Modes that don't use a given field simply ignore it — content is forward-compatible across styles.

## Styles

| Value | Description |
|---|---|
| `default` | antd `<Tag>` row, geekblue colour |
| `compact` | Same as default with tighter spacing (SCSS-only) |
| `matrix` | Editorial capability matrix: label + animated bar fill + 0–10 score |
| `stack-grid` | 6-column tech-stack grid; per-cell category caption + big name; `featured` cells fill with accent |

Source: `ESkillPillsStyle` enum in [`SkillPills.types.ts`](../../ui/client/modules/SkillPills/SkillPills.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/SkillPills/SkillPillsEditor.tsx`](../../ui/admin/modules/SkillPills/SkillPillsEditor.tsx)

Fields (top-to-bottom):

- **Category label** — `<Input>` &nbsp;·&nbsp; carries `data-testid="module-editor-primary-text-input"` &nbsp;·&nbsp; placeholder `e.g. Tech stack`
- **Skills (press Enter after each)** — antd `<Select mode="tags">` with `,` and `;` token separators; placeholder `React, Node.js, GraphQL…`

The editor only writes string items. To author scored / per-item-category content (for `matrix` or `stack-grid` styles), edit the JSON directly via MCP `section update`.

## Public rendering

**File:** [`ui/client/modules/SkillPills/SkillPills.tsx`](../../ui/client/modules/SkillPills/SkillPills.tsx)

Default layout:

```html
<div class="skill-pills default">
    <div class="skill-pills__category">
        <span>{category}</span>
        <span class="skill-pills__category-meta">{categoryMeta}</span>
    </div>
    <div class="skill-pills__list">
        <span class="ant-tag">{item.label}</span>
        <!-- ... -->
    </div>
</div>
```

Matrix layout: each item becomes a row with `<span class="skill-pills__label">`, `<span class="skill-pills__bar"/>` (CSS-animated width via `--skill-pills-w`), and `<span class="skill-pills__score">`.

Stack-grid layout: 6-col grid of `<div class="skill-pills__stack-cell">` with a `__stack-cat` caption + `__stack-name`.

The whole module is wrapped in `<RevealOnScroll>`.

**Theming tokens consumed (SkillPills.scss):** `--token-color-accent` (matrix bar fill, featured fill), text colour tokens.

**Italic-accent runs (`*word*`):** NOT supported — labels render verbatim through `<InlineTranslatable>`.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-skill-pills` |
| Rendered module container (admin + public) | `section-module-row-skill-pills` |
| Edit affordance on the section row (admin) | `section-module-edit-skill-pills-btn` |
| Primary text input (admin) | `module-editor-primary-text-input` (on Category label) |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.SkillPills,
    style: 'default',
    content: {
        category: m(EItemType.SkillPills),
        items: ['typescript', 'mongo', 'redis'],
    },
    markerText: m(EItemType.SkillPills),
}
```

---

## MCP commands

```bash
cms section add my-page SKILL_PILLS --sample
cms section add my-page SKILL_PILLS --content '{"category":"Backend","items":[{"label":"Node","score":9,"featured":true},"Mongo"]}'
cms section update <id> --style matrix
```

`cms module describe SKILL_PILLS` returns the content schema + style enum + sample as JSON.

---

## Notes

- The `score`, `category`, and `featured` fields only have visual effect in `matrix` / `stack-grid` modes. Authoring them for `default` is harmless (silently ignored).
- The animation in `matrix` mode is pure CSS — `--skill-pills-w` and `--skill-pills-d` are set inline; the SCSS keyframe transitions the bar in.
