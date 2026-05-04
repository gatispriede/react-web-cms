# `BlogFeed` (`EItemType.BlogFeed`)

> Live blog post listing pulled from the `Posts` collection. Filters by tag, limits count, optionally renders a section heading.

`item.type`: `BLOG_FEED` &nbsp;·&nbsp; `item.style`: `default` (one of [`EBlogFeedStyle`](../../ui/client/modules/BlogFeed/BlogFeed.types.ts))

---

## Content shape

```ts
{
    limit: number;                     // max posts to render (defaults to 6)
    tag: string;                       // tag filter ("" = no filter)
    heading: string;                   // optional section heading above the cards
}
```

## Styles

| Value | Description |
|---|---|
| `default` | Standard card grid |
| `compact` | Tighter card layout |

Source: `EBlogFeedStyle` enum in [`BlogFeed.types.ts`](../../ui/client/modules/BlogFeed/BlogFeed.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/BlogFeed/BlogFeedEditor.tsx`](../../ui/admin/modules/BlogFeed/BlogFeedEditor.tsx)

Fields:

- **Post count** — `<InputNumber>` (min 1, max 24)
- **More options** (collapsed):
  - **Section heading (optional)** — `<Input>` &nbsp;·&nbsp; carries `data-testid="module-editor-primary-text-input"` &nbsp;·&nbsp; placeholder `Latest writing`
  - **Filter by tag (optional)** — `<Input>`

## Public rendering

**File:** [`ui/client/modules/BlogFeed/BlogFeed.tsx`](../../ui/client/modules/BlogFeed/BlogFeed.tsx)

The component reads from `usePrefetchedPosts()` (SSG-prefetched) when available, otherwise lazy-fetches via `PostApi.list({limit})`. Filters by `tag` client-side, then slices to `limit`.

```html
<div>
    <h3>{heading}</h3>                 <!-- when heading is set -->
    <div class="blog-feed">
        <a href="/blog/{slug}">
            <div class="ant-card blog-card">
                <img src="{coverImage}" alt="{title}"/>      <!-- when coverImage is set -->
                <div class="ant-card-meta">
                    <div class="ant-card-meta-title">{title}</div>
                    <div class="ant-card-meta-description">
                        <span>{publishedAt.slice(0, 10)}</span>
                        <span>{excerpt}</span>
                        <Tag>{tag}</Tag><!-- first 3 -->
                    </div>
                </div>
            </div>
        </a>
        <!-- more cards -->
    </div>
</div>
```

While loading (no prefetched data): renders an `<Spin/>`. When the filtered list is empty: renders `<Empty description="No posts yet."/>`.

Each card is wrapped in `<RevealOnScroll>` with delay `i * 60`.

**Theming tokens consumed (BlogFeed.scss):** typography, surface, hover/lift transitions.

**Italic-accent runs (`*word*`):** **supported on `heading`** (per `module-interfaces.md`'s cross-module note — heading goes through `<InlineTranslatable>`, and the global `.em-accent` style still applies to any `<em>` it produces).

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-blog-feed` |
| Rendered module container (admin + public) | `section-module-row-blog-feed` |
| Edit affordance on the section row (admin) | `section-module-edit-blog-feed-btn` |
| Primary text input (admin) | `module-editor-primary-text-input` (on Section heading) |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.BlogFeed,
    style: 'default',
    content: {limit: 3, tag: '', heading: m(EItemType.BlogFeed)},
    markerText: m(EItemType.BlogFeed),
}
```

The chain spec asserts the `heading` text appears on the public render.

---

## MCP commands

```bash
cms section add my-page BLOG_FEED --sample
cms section add my-page BLOG_FEED --content '{"limit":6,"tag":"engineering","heading":"Latest writing"}'
cms section update <id> --style compact
```

---

## Notes

- The fetch is **client-side** unless `usePrefetchedPosts()` returns hydrated data — server-rendered pages should populate the posts context to avoid a flash of `<Spin/>`.
- An empty `tag` string disables filtering. The check is `c.tag ? ... : ...`, so any truthy string applies the filter.
- The post list shows up to **3 tags per card** (`p.tags.slice(0, 3)`).
- Cards link to `/blog/{slug}` — the SPA router intercepts the click; full reload only happens on direct address-bar entry.
