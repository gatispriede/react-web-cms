# `Gallery` (`EItemType.Image`)

> Multi-image grid with optional captions, lightbox preview, and four scroll/marquee variants. Shares the `IMAGE` enum with [`image.md`](image.md) (PlainImage) — disambiguated by content shape and style.

`item.type`: `IMAGE` &nbsp;·&nbsp; `item.style`: `default` (one of [`EGalleryStyle`](../../ui/client/modules/Gallery/Gallery.types.ts))

---

## Content shape

```ts
{
    items: IGalleryItem[];
    disablePreview: boolean;           // when true, antd lightbox preview is disabled
    aspectRatio?: 'free' | '1:1' | '4:3' | '3:2' | '16:9';
}

interface IGalleryItem {
    alt: string;
    src: string;                       // path, e.g. "api/photo.jpg" — leading slash added on render
    text: string;                      // caption text
    height: number;
    imgWidth: string;
    imgHeight: string;
    textPosition: 'TOP' | 'BOTTOM';    // ETextPosition — uppercase string literal
    preview: boolean;                  // per-item lightbox toggle (overridable by disablePreview)
    href?: string;                     // optional tile link (anchor wrap; clones in marquee mode never link)
}
```

## Styles

| Value | Description |
|---|---|
| `default` | Standard grid (3:2 aspect baked in unless `aspectRatio` is set) |
| `marquee` | Infinite horizontal scroll strip — pauses on hover; items duplicated once via CSS to hide the wrap-seam |
| `logo-wall` | Marquee variant without text captions |
| `hazard-strip` | Industrial accent-bg ticker — uppercase labels with bullets, uses `text` field, ignores `src` |
| `masonry` | Mixed portrait/landscape CSS-columns layout (no JS layout engine) |

Source: `EGalleryStyle` enum in [`Gallery.types.ts`](../../ui/client/modules/Gallery/Gallery.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/Gallery/GalleryEditor.tsx`](../../ui/admin/modules/Gallery/GalleryEditor.tsx)

Top toolbar:

- **Aspect ratio** — `<Select>` with values `free | 1:1 | 4:3 | 3:2 | 16:9`
- **Bulk upload** — opens `<BulkImageUploadModal>`; uploaded files are appended as new items

Item grid (one tile card per item):

- **Thumbnail** — drop target; shows image preview from `/{src}` or "No image" placeholder
- **File name caption** — derived from `src`
- **`<ImageUpload>`** widget
- Action row: **Move up / Move down / Delete / Show more** buttons

Show-more reveals:

- **Description** — `<Input>` (per-item caption text)
- **Image width / height** — paired `<Input>`s with `normalizeCssDimension` on blur
- **Link (optional)** — `<LinkTargetPicker>`

Top-level: **Add New Image** button + dropzone footer.

**No `module-editor-primary-text-input`** — image-only module.

## Public rendering

**File:** [`ui/client/modules/Gallery/Gallery.tsx`](../../ui/client/modules/Gallery/Gallery.tsx)

```html
<div class="gallery-wrapper gallery-wrapper-app default" data-aspect-ratio="3:2">
    <div class="gallery-wrapper-images">
        <!-- Image.PreviewGroup wraps originals -->
        <div class="container text-bottom">
            <div class="image"><img src="/{src}" alt="{alt}"/></div>
            <div class="text"><p>{text}</p></div>
        </div>
        <!-- ... -->
        <!-- marquee/logo-wall/hazard-strip: clones rendered after, aria-hidden -->
    </div>
</div>
```

Tiles with `href` render as `<a class="gallery-tile--link">` (originals only — clones never link). Marquee duplicates render outside `<Image.PreviewGroup>` so the lightbox counter stays at N/N.

**Theming tokens consumed (Gallery.scss):** caption typography, surface borders, marquee animation timings.

**Italic-accent runs (`*word*`):** NOT supported.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-gallery` |
| Rendered module container (admin + public) | `section-module-row-gallery` |
| Edit affordance on the section row (admin) | `section-module-edit-gallery-btn` |
| Primary text input (admin) | **intentionally absent** — image-only module |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

`module-editor-primary-text-input` is intentionally absent. The e2e chain spec falls back to `assertSelector` (see below).

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.Gallery,
    style: 'default',
    content: {
        items: [
            {
                alt: m(EItemType.Gallery),
                src: placeholderImg,
                text: '',
                height: 200,
                imgWidth: 200,
                imgHeight: 200,
                textPosition: 'BOTTOM',
                preview: false,
            },
        ],
        disablePreview: false,
    },
    markerText: m(EItemType.Gallery),
    assertSelector: `img[alt*="${m(EItemType.Gallery)}"]`,
}
```

`assertSelector` matches an `<img>` whose `alt` contains the marker — used by the public-render assertion since there's no text content to grep.

---

## MCP commands

```bash
cms section add my-page GALLERY --sample
cms section add my-page GALLERY --content '{"items":[{"src":"api/a.jpg","alt":"A","text":"","textPosition":"BOTTOM","preview":true,"imgWidth":"","imgHeight":"","height":0}],"disablePreview":false,"aspectRatio":"4:3"}'
cms section update <id> --style marquee
```

---

## Notes

- **Marquee clones are aria-hidden** — screen readers announce only the originals. Clones serve only to seam the CSS scroll loop visually.
- **`href` on a tile suppresses the lightbox preview** — anchor navigation wins; the click handler stops propagation so antd's `<Image>` preview trigger doesn't fire.
- **Per-gallery aspect-ratio** lock applies via `[data-aspect-ratio]` rules in `Gallery.scss`. `free` skips the lock; default style keeps the historical 3:2 baked in.
- See [`image.md`](image.md) (single image, same enum) and [`carousel.md`](carousel.md) (slideshow with arrows / dots).
