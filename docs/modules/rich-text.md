# `RichText` (`EItemType.RichText`)

> Long-form prose / formatted HTML body. Backed by CKEditor in the admin; rendered through DOMPurify on the public site.

`item.type`: `RICH_TEXT` &nbsp;·&nbsp; `item.style`: `default` (one of [`ERichTextStyle`](../../ui/client/modules/RichText/RichText.types.ts))

---

## Content shape

`IItem.content` for `RICH_TEXT` is a JSON-stringified object with a single field:

```ts
{
    value: string;                     // HTML — sanitized on render via DOMPurify
}
```

That's it. The whole module is one HTML blob.

**Sanitization:** every render passes `value` through `isomorphic-dompurify` with the project's allowed-tags list (configured in `ui/client/lib/sanitize.ts` or equivalent — search for `DOMPurify.sanitize`). `<script>`, inline event handlers, `javascript:` URLs, and `<iframe>` are stripped.

## Styles

| Value | Description |
|---|---|
| `default` | Prose wrapper, max-width column, theme typography |
| `centered-boxed` | Centered column, surrounding card with theme-token border + bg |

Source: `ERichTextStyle` enum at [`RichText.types.ts`](../../ui/client/modules/RichText/RichText.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/RichText/RichTextEditor.tsx`](../../ui/admin/modules/RichText/RichTextEditor.tsx)

Single field:

- **Body** — full CKEditor instance (toolbar with bold / italic / link / list / heading levels).

The editor has a known constraint with testid placement — CKEditor's `contenteditable` doesn't accept `data-testid`. The editor file mounts a hidden `<textarea data-testid="module-editor-primary-text-input">` mirroring the editor's value, so Playwright can `fill()` it programmatically. Real users only see the CKEditor surface.

`module-editor-primary-text-input` is on the hidden `<textarea>`, not on the visible CKEditor frame — see the `// DECISION:` comment at the top of `RichTextEditor.tsx`.

## Public rendering

**File:** [`ui/client/modules/RichText/RichText.tsx`](../../ui/client/modules/RichText/RichText.tsx)

HTML structure (simplified):

```html
<section class="module-rich-text rich-text-style-default">
    <div class="prose"><!-- DOMPurify-sanitized content.value --></div>
</section>
```

**Theming tokens consumed:** `--token-color-text`, `--token-color-text-muted`, `--token-color-link`, `--token-color-link-hover`, `--token-font-body`, `--token-prose-max-width`, list and heading rhythm tokens (`--token-prose-h2-size`, etc.).

**Italic-accent runs (`*word*`):** NOT supported here — RichText already accepts arbitrary HTML, so use `<em>` directly. The accent-runs preprocessor only fires on plain-text fields elsewhere.

**Internal links:** if `value` contains `<a href="/lv/...">`, public render keeps it; the SPA router intercepts on click.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-rich-text` |
| Rendered module container (admin + public) | `section-module-row-rich-text` |
| Edit affordance on the section row (admin) | `section-module-edit-rich-text-btn` |
| Primary text input (admin, hidden mirror) | `module-editor-primary-text-input` |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.RichText,
    style: 'default',
    content: {value: `<p><strong>${m(EItemType.RichText)}</strong></p>`},
    markerText: m(EItemType.RichText),
}
```

---

## MCP commands

```bash
# Add a RichText with the default sample content
cms section add my-page RICH_TEXT --sample

# Add with custom HTML
cms section add my-page RICH_TEXT --content '{"value":"<h2>Hello</h2><p>Body...</p>"}'

# Replace the content (e.g. translation)
cms section update <id> --content '{"value":"<h2>Sveiki</h2><p>...</p>"}'
```

`cms module describe RICH_TEXT` returns the (single-field) content schema + style enum + sample as JSON.

---

## Notes

- **HTML is the content**, not Markdown. If MCP / AI clients pass Markdown, the producer must convert before calling `section update` — the renderer never parses Markdown.
- **`<style>` and `<script>` tags are stripped** by DOMPurify regardless of how they're authored. Inline `style=""` attributes survive.
- **No translation overlay** — RichText body is treated as a single key in the existing `next-i18next` overlay (`section.<sectionId>.item.<itemIndex>.value`) and surfaces in the CSV editor as one large cell. For multilingual long-form content, prefer authoring per locale rather than relying on inline translation.
- **Don't nest RichText in itself** — the editor doesn't prevent it (you'd type raw HTML), but the resulting render has nested `.prose` wrappers and theme rhythm gets weird.
