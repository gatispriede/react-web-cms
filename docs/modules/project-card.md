# `ProjectCard` (`EItemType.ProjectCard`)

> Single project card — cover image, title, description, tag chips, and up to two action links. Different from [`project-grid.md`](project-grid.md): ProjectCard is one standalone card; ProjectGrid is a section of many.

`item.type`: `PROJECT_CARD` &nbsp;·&nbsp; `item.style`: `default` (one of [`EProjectCardStyle`](../../ui/client/modules/ProjectCard/ProjectCard.types.ts))

---

## Content shape

```ts
{
    title: string;                     // project title
    description: string;               // short paragraph
    image: string;                     // cover image URL
    tags: string[];                    // chip row
    primaryLink?: IProjectLink;        // primary CTA — antd Button type="primary"
    secondaryLink?: IProjectLink;      // secondary CTA
}

interface IProjectLink {
    url: string;
    label: string;
}
```

## Styles

| Value | Description |
|---|---|
| `default` | Standard card |
| `featured` | Larger / highlighted variant |

Source: `EProjectCardStyle` enum in [`ProjectCard.types.ts`](../../ui/client/modules/ProjectCard/ProjectCard.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/ProjectCard/ProjectCardEditor.tsx`](../../ui/admin/modules/ProjectCard/ProjectCardEditor.tsx)

Top fields:

- **Title** — `<Input>` &nbsp;·&nbsp; carries `data-testid="module-editor-primary-text-input"`
- **Cover image URL** — `<ImageUrlInput>` (paste/upload/pick)
- **Short description** — `<TextArea>` rows=3
- **Tags (Enter after each)** — antd `<Select mode="tags">` with `,` and `;` token separators

Collapsible **More options (links)**:

- **Primary link URL + Label** — paired `<Input>`s
- **Secondary link URL + Label** — paired `<Input>`s

## Public rendering

**File:** [`ui/client/modules/ProjectCard/ProjectCard.tsx`](../../ui/client/modules/ProjectCard/ProjectCard.tsx)

Wraps antd's `<Card hoverable>`:

```html
<div class="ant-card project-card default">
    <div class="ant-card-cover">
        <img alt="{title}" src="{image}" style="object-fit: cover; max-height: 200px"/>
    </div>
    <div class="ant-card-meta">
        <div class="ant-card-meta-title">{title}</div>
        <div class="ant-card-meta-description">
            <span>{description}</span>
            <span class="ant-tag">{tag}</span>     <!-- per tag -->
            <a class="ant-btn ant-btn-primary" href="{primaryLink.url}" target="_blank" rel="noopener noreferrer">
                <!-- icon: GithubOutlined if github.com, ExportOutlined if http(s), else LinkOutlined -->
                {primaryLink.label || 'Open'}
            </a>
            <a class="ant-btn" href="{secondaryLink.url}" target="_blank" rel="noopener noreferrer">
                {secondaryLink.label || 'More'}
            </a>
        </div>
    </div>
</div>
```

Cover is omitted when `image` is empty (no broken `<img>` fallback). Buttons render only when their `url` is non-empty.

**Theming tokens consumed (ProjectCard.scss):** card surface tokens, hover lift, button colours.

**Italic-accent runs (`*word*`):** NOT supported.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-project-card` |
| Rendered module container (admin + public) | `section-module-row-project-card` |
| Edit affordance on the section row (admin) | `section-module-edit-project-card-btn` |
| Primary text input (admin) | `module-editor-primary-text-input` (on Title) |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.ProjectCard,
    style: 'default',
    content: {
        title: m(EItemType.ProjectCard),
        description: 'sample description',
        image: placeholderImg,
        tags: ['sample'],
    },
    markerText: m(EItemType.ProjectCard),
}
```

The chain spec asserts the marker title appears on the public render.

---

## MCP commands

```bash
cms section add my-page PROJECT_CARD --sample
cms section add my-page PROJECT_CARD --content '{"title":"Acme","description":"A thing.","image":"api/cover.jpg","tags":["TS","Mongo"],"primaryLink":{"url":"https://example.com","label":"Live"},"secondaryLink":{"url":"https://github.com/me/acme","label":"Source"}}'
cms section update <id> --style featured
```

---

## Notes

- Link icons are auto-picked from the URL: `github.com` → `<GithubOutlined>`, any `http(s):` URL → `<ExportOutlined>`, anything else → `<LinkOutlined>`.
- Empty cover image suppresses the `<img>` element entirely — guards against broken render. Set a valid `image` URL or omit the field.
- See [`project-grid.md`](project-grid.md) for the multi-project section variant. Use ProjectCard standalone in the middle of long-form content; ProjectGrid for a curated list section.
