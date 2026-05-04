# `ProjectGrid` (`EItemType.ProjectGrid`)

> A grid of project cards with a coloured cover (gradient / image), big "art letters" overlay, year pill, and meta strip. Different from [`project-card.md`](project-card.md): ProjectGrid is a section header + many cards; ProjectCard is a single standalone card module.

`item.type`: `PROJECT_GRID` &nbsp;·&nbsp; `item.style`: `default` (one of [`EProjectGridStyle`](../../ui/client/modules/ProjectGrid/ProjectGrid.types.ts))

---

## Content shape

```ts
{
    sectionNumber?: string;            // mono label above the title
    sectionTitle?: string;             // supports `*italic-accent*`
    sectionSubtitle?: string;          // small blurb under the title
    items: IProjectGridItem[];
}

interface IProjectGridItem {
    title: string;                     // required — project name
    stack?: string;                    // domain / stack string
    kind?: string;                     // 2-line right-side sublabel; allows `<br/>`
    year?: string;                     // pill on the cover (e.g. "2024 — PRESENT")
    coverArt?: string;                 // letters inside the cover (defaults to title.slice(0, 2).toUpperCase())
    coverColor?: string;               // any CSS background — gradient / image / solid
    moreLabel?: string;                // CTA label rendered at the bottom of the card
    href?: string;                     // project detail URL
}
```

## Styles

| Value | Description |
|---|---|
| `default` | Standard grid |
| `studio` | 2-col cards with coloured gradient covers + art letters (Studio design-v2) |

Source: `EProjectGridStyle` enum in [`ProjectGrid.types.ts`](../../ui/client/modules/ProjectGrid/ProjectGrid.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/ProjectGrid/ProjectGridEditor.tsx`](../../ui/admin/modules/ProjectGrid/ProjectGridEditor.tsx)

Top-level:

- **Section number** — `<Input>` placeholder `§ 01`
- **Section title** — `<Input>` placeholder `See it in *action.*` &nbsp;·&nbsp; supports `*italic-accent*`
- **Section subtitle** — `<TextArea>` rows=2

Each project card (sortable):

- **Title** — `<LabeledInput>` &nbsp;·&nbsp; **first item only** carries `data-testid="module-editor-primary-text-input"`
- **Stack / domain** — `<LabeledInput>`
- **Kind** — `<LabeledInput>` placeholder `Contract<br/>UK / USA`
- **Year + Art** — paired `<LabeledInput>`s
- **Cover CSS** — `<LabeledInput>` placeholder `radial-gradient(circle at 20% 80%, #1E5A6B, #0B1E24 70%)`
- **More label + Link** — `<LabeledInput>` + `<LinkTargetPicker>`

Top-level: **Add project** button.

## Public rendering

**File:** [`ui/client/modules/ProjectGrid/ProjectGrid.tsx`](../../ui/client/modules/ProjectGrid/ProjectGrid.tsx)

```html
<section class="project-grid default">
    <header class="project-grid__head">
        <div class="project-grid__num">{sectionNumber}</div>
        <h2 class="project-grid__title">{sectionTitle (with em.em-accent)}</h2>
        <div class="project-grid__sub">{sectionSubtitle}</div>
    </header>
    <div class="project-grid__items">
        <a class="project-grid__item" href="{href}">
            <div class="project-grid__cover" style="background: {coverColor}">
                <span class="project-grid__year">{year}</span>
                <span class="project-grid__art">{coverArt || title.slice(0,2).toUpperCase()}</span>
            </div>
            <div class="project-grid__meta">
                <div class="project-grid__meta-main">
                    <h3 class="project-grid__card-title">{title}</h3>
                    <div class="project-grid__stack">{stack}</div>
                </div>
                <div class="project-grid__kind"><!-- innerHTML so <br/> works --></div>
            </div>
            <div class="project-grid__more">{moreLabel}</div>
        </a>
        <!-- more items -->
    </div>
</section>
```

Cards without `href` render as `<div>` instead of `<a>`. `kind` is injected via `dangerouslySetInnerHTML` (string-translated first) to allow `<br/>`.

Each card wrapped in `<RevealOnScroll>` with delay `i * 60`.

**Theming tokens consumed (ProjectGrid.scss):** `--token-color-accent`, surface tokens, typography. Cover ratios via `aspect-ratio`.

**Italic-accent runs (`*word*`):** supported on **`sectionTitle`** only.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-project-grid` |
| Rendered module container (admin + public) | `section-module-row-project-grid` |
| Edit affordance on the section row (admin) | `section-module-edit-project-grid-btn` |
| Primary text input (admin) | `module-editor-primary-text-input` (on the **first item's** Title) |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.ProjectGrid,
    style: 'default',
    content: {
        items: [{title: m(EItemType.ProjectGrid)}],
    },
    markerText: m(EItemType.ProjectGrid),
}
```

---

## MCP commands

```bash
cms section add my-page PROJECT_GRID --sample
cms section add my-page PROJECT_GRID --content '{"sectionTitle":"See it in *action.*","items":[{"title":"SciChart","stack":"3D charts","year":"2024 — PRESENT","coverColor":"radial-gradient(circle, #1E5A6B, #0B1E24)"}]}'
cms section update <id> --style studio
```

---

## Notes

- **`kind` allows raw HTML `<br/>`** — it's injected via `dangerouslySetInnerHTML` after a `translateOrKeep` pass. Other tags survive but are not sanitised — author-controlled field; treat carefully when ingesting external data.
- See [`project-card.md`](project-card.md) — the standalone single-card variant. Use ProjectGrid for a list, ProjectCard for one.
