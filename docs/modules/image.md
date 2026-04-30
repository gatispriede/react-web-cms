# `PlainImage` (`EItemType.Image`)

> A single image — inline tile, full-width background, or fixed parallax. Disambiguated from [`gallery.md`](gallery.md) and [`carousel.md`](carousel.md) by `item.style` (PlainImage is always `default` and uses a different content shape).

`item.type`: `IMAGE` &nbsp;·&nbsp; `item.style`: `default` (one of [`EImageStyle`](../../ui/client/modules/PlainImage/PlainImage.types.ts))

---

## Content shape

```ts
{
    src: string;                       // image path, e.g. "api/photo.jpg"
    alt: string;                       // accessibility alt text
    description: string;               // HTML rich-text description below the image
    height: number;                    // legacy — currently unused at render
    preview: boolean;                  // antd <Image> preview overlay enabled
    imgWidth: string;                  // CSS width string ("400px", "100%")
    imgHeight: string;                 // CSS height string
    useAsBackground: boolean;          // render as full-width body background instead of inline
    imageFixed: boolean;               // background-attachment: fixed (parallax)
    useGradiant: boolean;              // overlay a white-fade gradient (sic — "gradiant" is the field name)
    offsetX: number;                   // vertical offset in px (margin-top)
}
```

`IMAGE` is shared with Gallery (different content shape) — Gallery uses `{items, disablePreview, aspectRatio}`. Disambiguation is by content keys, not by enum.

## Styles

| Value | Description |
|---|---|
| `default` | Single style; behaviour is driven by `useAsBackground` / `imageFixed` / `useGradiant` |

Source: `EImageStyle` enum in [`PlainImage.types.ts`](../../ui/client/modules/PlainImage/PlainImage.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/PlainImage/PlainImageEditor.tsx`](../../ui/admin/modules/PlainImage/PlainImageEditor.tsx)

The editor is wrapped in an `<ImageDropTarget>` so the operator can drop an image file anywhere on the panel.

Settings (top):

- **Use as background image** — `<Switch>`
- **Make image fixed position** — `<Switch>`
- **Use gradiant** — `<Switch>` (white-fade overlay over the image)
- **Image vertical offset** — `<Input>` (px)
- **Image width / height** — `<Input>`s with `onBlur` `normalizeCssDimension` (auto-appends `px` for bare numbers)

Image:

- **Image** — `<ImageUpload>` widget + disabled `<Input>` showing the path
- **Description** (when not background) — dynamically-loaded RichText editor (CKEditor)

Notes:

- **No `module-editor-primary-text-input`** — image-only module. The e2e chain spec falls back to `assertSelector` (see Sample content below).
- The Description field is full HTML and renders via `extractTranslationsFromHTML`.

## Public rendering

**File:** [`ui/client/modules/PlainImage/PlainImage.tsx`](../../ui/client/modules/PlainImage/PlainImage.tsx)

When `useAsBackground === false`:

```html
<div class="plain-image default">
    <img src="/{src}" width="{imgWidth}" height="{imgHeight}" style="margin-top: {offsetX}px"/>
    <div class="content"><div><!-- description HTML, translation-resolved --></div></div>
</div>
```

When `useAsBackground === true`:

```html
<div class="background-image fixed?" style="
    background-image: url(/{src});  /* or linear-gradient(...) + url(...) when useGradiant */
    background-size: {imgWidth || cover};
    position: fixed | absolute;
    width: 100%;
    height: 100vh | document-height;
    z-index: -1;
    pointer-events: none;
"></div>
```

In admin mode (`admin` prop true), background images get a small floating chip showing the image path overlay for editor convenience.

**Theming tokens consumed (PlainImage.scss):** layout / spacing tokens; the image itself is theme-agnostic.

**Italic-accent runs (`*word*`):** NOT supported (the description is HTML).

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-image` |
| Rendered module container (admin + public) | `section-module-row-image` |
| Edit affordance on the section row (admin) | `section-module-edit-image-btn` |
| Primary text input (admin) | **intentionally absent** — the e2e chain spec asserts on `assertSelector` instead |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

`module-editor-primary-text-input` is **intentionally absent** for image-only modules. Specs check `count() > 0` before filling.

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.Image,
    style: 'default',
    content: {
        src: placeholderImg,           // 'https://funisimo.pro/screenshots/placeholder.png'
        alt: m(EItemType.Image),
        description: '',
        height: 200,
        preview: false,
        imgWidth: 200,
        imgHeight: 200,
        useAsBackground: false,
        imageFixed: false,
        useGradiant: false,
        offsetX: 0,
    },
    assertSelector: `img[alt*="${m(EItemType.Image)}"]`,
}
```

The chain spec asserts `assertSelector` against the public render rather than relying on `markerText`.

---

## MCP commands

```bash
cms section add my-page IMAGE --sample
cms section add my-page IMAGE --content '{"src":"api/photo.jpg","alt":"Studio shot","description":"<p>Caption</p>","preview":true,"imgWidth":"100%","imgHeight":"","useAsBackground":false,"imageFixed":false,"useGradiant":false,"offsetX":0,"height":0}'
```

---

## Notes

- **Field name typo `useGradiant`** is preserved for backwards compatibility — bundles older than 2024 use that spelling. Don't rename.
- **`useAsBackground` images** position absolute / fixed under the page content (`z-index: -1`). They don't participate in the section flow — multiple background images on one page will stack.
- See [`gallery.md`](gallery.md) (multi-image grid) and [`carousel.md`](carousel.md) (slideshow) for related image modules; all three share the `IMAGE` enum but with different content shapes.
