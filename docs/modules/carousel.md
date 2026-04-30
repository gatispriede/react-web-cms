# `Carousel` (`EItemType.Carousel`)

> Slide carousel — one image-with-caption visible at a time, with optional autoplay, infinite loop, dots, and arrows. Reuses [`gallery.md`](gallery.md)'s `IGalleryItem` shape for items.

`item.type`: `CAROUSEL` &nbsp;·&nbsp; `item.style`: `default` (one of [`ECarouselStyle`](../../ui/client/modules/Carousel/Carousel.types.ts))

---

## Content shape

```ts
{
    items: IGalleryItem[];             // see Gallery.types.ts (alt, src, text, textPosition, ...)
    autoplay: boolean;
    infinity: boolean;                 // looping
    autoplaySpeed: number;             // milliseconds (default 3000)
    dots: boolean;                     // dot indicators at bottom
    arrows: boolean;                   // prev/next arrows
    disablePreview: boolean;           // suppresses lightbox preview on slide images
}
```

`IGalleryItem` is shared with Gallery — `{alt, src, text, textPosition, preview, height, imgWidth, imgHeight, href?}`.

## Styles

| Value | Description |
|---|---|
| `default` | Standard 16:9 slide with bottom gradient caption |
| `cinematic` | Edge-to-edge tall crop with centered card-style caption overlay |
| `polaroid` | White frame + caption printed below; slight rotation on inactive slides |
| `ribbon` | Thin 21:9 ribbon strip — minimal chrome, for interstitial rhythm |
| `editorial` | Square crop, large sans caption block on the right with a mono attribution line |

Source: `ECarouselStyle` enum in [`Carousel.types.ts`](../../ui/client/modules/Carousel/Carousel.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/Carousel/CarouselEditor.tsx`](../../ui/admin/modules/Carousel/CarouselEditor.tsx)

Top settings:

- **Autoplay** — `<Switch>`
- **Autoplay speed** — `<Input>` (ms, default 3000) — tooltip: "(In miliseconds - default = 3000)"
- **Infinity** — `<Switch>`
- **Dots** — `<Switch>`
- **Arrows** — `<Switch>`

Item list (each wrapped in an `<EditWrapper>` with delete button):

- **Image** — `<ImageDropTarget>` + inline thumbnail (72×54) + `<ImageUpload>` widget + disabled URL `<Input>`
- **Description** — caption `<Input>`

Top-level: **Add new Image** button + dropzone footer.

**No `module-editor-primary-text-input`** — image-only module.

## Public rendering

**File:** [`ui/client/modules/Carousel/Carousel.tsx`](../../ui/client/modules/Carousel/Carousel.tsx)

Wraps antd's `<Carousel>`:

```html
<div>
    <div class="carousel-wrapper {style}" style="display: block">
        <div class="ant-carousel">
            <li class="container text-bottom">
                <div class="image"><img src="/{src} or {src}" alt="{alt}"/></div>
                <div class="text"><p>{text}</p></div>
            </li>
            <!-- more slides -->
        </div>
    </div>
</div>
```

`disablePreview` here is forced based on `item.action !== "onClick"` — the antd `<Image preview={false}>` prop is hardcoded; lightbox is effectively suppressed for the carousel viewer.

`item.style` (other than `default`) becomes a class on `.carousel-wrapper`, layered on top of the shared base treatment by per-style SCSS rules.

**Theming tokens consumed (Carousel.scss):** caption typography, dot/arrow colour tokens, slide aspect ratios per style.

**Italic-accent runs (`*word*`):** NOT supported.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-carousel` |
| Rendered module container (admin + public) | `section-module-row-carousel` |
| Edit affordance on the section row (admin) | `section-module-edit-carousel-btn` |
| Primary text input (admin) | **intentionally absent** — image-only module |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

`module-editor-primary-text-input` is intentionally absent. The e2e chain spec falls back to `assertSelector` (see below).

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.Carousel,
    style: 'default',
    content: {
        items: [
            {
                alt: m(EItemType.Carousel),
                src: placeholderImg,
                text: '',
                height: 200,
                imgWidth: 200,
                imgHeight: 200,
                textPosition: 'BOTTOM',
                preview: false,
            },
        ],
        autoplay: false,
        infinity: false,
        autoplaySpeed: 0,
        dots: false,
        arrows: false,
        disablePreview: true,
    },
    assertSelector: `img[alt*="${m(EItemType.Carousel)}"]`,
}
```

The chain spec asserts on `assertSelector` since there's no public-render text marker.

---

## MCP commands

```bash
cms section add my-page CAROUSEL --sample
cms section add my-page CAROUSEL --content '{"items":[{"src":"api/a.jpg","alt":"A","text":"slide","textPosition":"BOTTOM","preview":false,"imgWidth":"","imgHeight":"","height":0}],"autoplay":true,"infinity":true,"autoplaySpeed":4000,"dots":true,"arrows":true,"disablePreview":true}'
cms section update <id> --style cinematic
```

---

## Notes

- The renderer supports both relative (`api/...`) and absolute (`https://...` / leading-slash) `src` values — relative paths get a `/` prefix at render time.
- Items reuse `IGalleryItem` from [`gallery.md`](gallery.md). Don't duplicate the shape — import from `@client/modules/Gallery`.
- The `infinity` field name (rather than `infinite`) matches antd's `infinite` prop one-to-one but is mapped through.
