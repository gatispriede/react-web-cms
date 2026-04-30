# `<MODULE_TITLE>` (`EItemType.<EnumMember>`)

> One-line purpose. What does this module represent on a page?

`item.type`: `<TYPE_STRING>` &nbsp;·&nbsp; `item.style`: `<DEFAULT_STYLE_VALUE>` (one of [`E<Module>Style`](../../ui/client/modules/<Module>/<Module>.types.ts))

---

## Content shape

`IItem.content` for this type is a JSON-stringified object matching:

```ts
{
    field1: string;                 // required, what it represents
    field2?: number;                // optional, default behavior
    nested?: Array<{
        sub1: string;
    }>;
}
```

Keep close parity with [`docs/architecture/module-interfaces.md`](../architecture/module-interfaces.md) — this doc supersedes it on detail but they must not contradict.

## Styles

| Value | Description |
|---|---|
| `default` | Standard rendering |
| `<other>` | What changes |

Defined in `ui/client/modules/<Module>/<Module>.types.ts` — `E<Module>Style` enum.

---

## Admin authoring

**File:** `ui/admin/modules/<Module>/<Module>Editor.tsx`

Fields exposed in the editor (top-to-bottom in the Drawer):

- `field1` — `<Input>` / `<TextArea>` / `<Select>` / etc. **carries `data-testid="module-editor-primary-text-input"`** when that role applies (see [test-ids.md](../architecture/test-ids.md) §"When the rule isn't enough").
- `field2` — `<InputNumber>` / etc.
- ...

Validation handled where: client-side via the editor's `onChange` handlers, server-side via `addUpdateSectionItem` resolver against the section schema.

## Public rendering

**File:** `ui/client/modules/<Module>/<Module>.tsx`

HTML structure (simplified):

```html
<section class="module-<type-slug> style-<style>">
    <h2>{field1}</h2>
    <div class="...">{field2}</div>
</section>
```

**Theming tokens consumed:** `--token-color-accent`, `--token-color-text`, etc. (list the actual CSS variables this module references in its SCSS).

**Italic-accent runs:** `*word*` → `<em class="em-accent">word</em>` if the module supports rendered text. (Check the module's render code; cross-module behavior is documented in [`module-interfaces.md`](../architecture/module-interfaces.md).)

---

## Testids

Composed per the [convention](../architecture/test-ids.md). `<slug>` = `<TYPE_STRING>` lowercased with `_` → `-` (e.g. `RICH_TEXT` → `rich-text`).

| Where | Testid |
|---|---|
| Picker option in "Add module" dialog | `section-module-picker-<slug>` |
| Rendered module container (admin **and** public) | `section-module-row-<slug>` |
| Edit affordance on the section row (admin) | `section-module-edit-<slug>-btn` |
| Primary text input inside the editor (admin, when applicable) | `module-editor-primary-text-input` |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

For modules without a meaningful single text field (image-only types: Gallery, Image, Carousel), `module-editor-primary-text-input` is intentionally absent — the e2e chain spec checks `count() > 0` before filling.

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts) for `EItemType.<EnumMember>`. Contains:

- `style` — typically `"default"`
- `content` — minimum-valid shape with `markerText` (or `assertSelector` for image-only types) substituted in
- `markerText` — unique substring the e2e chain spec asserts is visible on the public render

If this module is **omitted** from the registry, list the reason: dev-portfolio-specific data, requires external integration (SMTP), etc.

---

## MCP commands

The MCP server (see [tooling/mcp-server.md](../features/tooling/mcp-server.md)) exposes:

- `cms module describe <TYPE_STRING>` — returns this doc's content shape + styles + sample as JSON
- `cms section add <pageSlug> <TYPE_STRING> [--style <style>] [--sample]` — adds an instance with sample content. Without `--sample`, requires `--content '<json>'`.
- `cms section update <sectionId> --content '<json>'` — replaces the content. Caller is responsible for shape compliance; the GraphQL resolver validates and rejects on mismatch.

Example (RichText):

```bash
cms section add my-page RICH_TEXT --sample
cms section update <returned-id> --content '{"value":"<p>hello</p>"}'
```

---

## Notes

- (Optional) Quirks: legacy fields, special interaction with i18n, theme-token edge cases, etc.
- (Optional) When you'd pick this module vs a similar one (Hero vs ProjectCard, RichText vs Manifesto, etc.).
- (Optional) Known issues / open questions.
