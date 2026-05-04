# `PlainText` (`EItemType.Text`)

> A single short string of plain text. Use when RichText is overkill — a one-line caption, label, or bare paragraph.

`item.type`: `TEXT` &nbsp;·&nbsp; `item.style`: `default` (one of [`EPlainTextStyle`](../../ui/client/modules/PlainText/PlainText.types.ts))

---

## Content shape

`IItem.content` for `TEXT` is a JSON-stringified object with a single field:

```ts
{
    value: string;                     // plain text — no HTML
}
```

The value is rendered through `<InlineTranslatable>`, so it participates in the inline-translation overlay (Alt-click in admin to edit per-locale) and the `tApp` lookup. Unlike RichText, the string is **not** parsed for HTML — angle brackets render literally.

## Styles

| Value | Description |
|---|---|
| `default` | Standard left-aligned paragraph |
| `centered` | Centered paragraph |
| `centeredBoxed` | Centered, surrounded by a card with theme-token border + bg |

Source: `EPlainTextStyle` enum in [`PlainText.types.ts`](../../ui/client/modules/PlainText/PlainText.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/PlainText/PlainTextEditor.tsx`](../../ui/admin/modules/PlainText/PlainTextEditor.tsx)

Single field:

- **Text** — antd `<Input>` &nbsp;·&nbsp; carries `data-testid="module-editor-primary-text-input"`

No validation beyond the text being a string. Empty string saves.

## Public rendering

**File:** [`ui/client/modules/PlainText/PlainText.tsx`](../../ui/client/modules/PlainText/PlainText.tsx)

HTML structure (simplified):

```html
<div class="plain-text default">
    <p><!-- InlineTranslatable wraps content.value --></p>
</div>
```

**Theming tokens consumed:** typography is inherited from the page-level theme — no module-specific tokens. The `centered` / `centeredBoxed` styles add layout / surface treatment via SCSS in `PlainText.scss`.

**Italic-accent runs (`*word*`):** NOT supported here. PlainText is rendered verbatim. Use RichText if you need emphasis.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-text` |
| Rendered module container (admin + public) | `section-module-row-text` |
| Edit affordance on the section row (admin) | `section-module-edit-text-btn` |
| Primary text input (admin) | `module-editor-primary-text-input` |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.Text,
    style: 'default',
    content: {value: m(EItemType.Text)},
    markerText: m(EItemType.Text),
}
```

---

## MCP commands

```bash
cms section add my-page TEXT --sample
cms section add my-page TEXT --content '{"value":"Short caption."}'
cms section update <id> --style centered
```

`cms module describe TEXT` returns the (single-field) content schema + style enum + sample as JSON.

---

## Notes

- **Pick PlainText over RichText** when the content is one short string with no formatting. RichText invokes CKEditor and DOMPurify on every render; PlainText is a single `<p>` and skips all that.
- **No `*word*` italic-accent.** That convention is reserved for fields documented to support it (Hero, Services, Testimonials, ProjectGrid, Manifesto, BlogFeed). PlainText renders the asterisks literally.
- Translatable through `tApp` — content authors can localize per-locale via the inline-translation Alt-click overlay.
