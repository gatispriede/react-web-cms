# `Manifesto` (`EItemType.Manifesto`)

> One large display-serif paragraph with inline chip references embedded mid-sentence. The Studio design-v2 statement block.

`item.type`: `MANIFESTO` &nbsp;·&nbsp; `item.style`: `default` (one of [`EManifestoStyle`](../../ui/client/modules/Manifesto/Manifesto.types.ts))

---

## Content shape

```ts
{
    body: string;                      // main paragraph; supports inline markup (see below)
    addendum?: string;                 // smaller sans-serif paragraph underneath
    chips?: IManifestoChip[];          // chip definitions referenced by body tokens
}

interface IManifestoChip {
    key: string;                       // looked up from `{{chip:KEY:LABEL}}` tokens in body
    thumb: string;                     // text inside the chip's left circle
    color?: string;                    // CSS background for the circle (defaults to bg-inset)
}
```

**Body markup helpers (mixable freely):**

- `*word*` → `<em class="em-accent">word</em>` (italic + accent colour)
- `{{chip:KEY:LABEL}}` → a rounded pill with a `thumb` circle on the left and `LABEL` body. `KEY` looks up `chips[]` for the thumb / colour. If the key isn't found, `LABEL` still renders and the thumb falls back to `KEY`.

Example body:

```text
From bold {{chip:react:brands}} to everyday {{chip:teams:teams}} I architect
{{chip:code:software}} for *people* and {{chip:cloud:products}} that have a problem worth solving.
```

## Styles

| Value | Description |
|---|---|
| `default` | Display-serif paragraph block |
| `accent` | Full-width accent-coloured band — teal/primary bg, accent-ink text (Brandappart design-v6) |

Source: `EManifestoStyle` enum in [`Manifesto.types.ts`](../../ui/client/modules/Manifesto/Manifesto.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/Manifesto/ManifestoEditor.tsx`](../../ui/admin/modules/Manifesto/ManifestoEditor.tsx)

Fields:

- **Body** — `<TextArea>` rows=6 &nbsp;·&nbsp; carries `data-testid="module-editor-primary-text-input"` &nbsp;·&nbsp; placeholder includes `*italic*` and `{{chip:KEY:LABEL}}` tokens. Help text under the field explains the chip syntax.
- **Addendum** — `<TextArea>` rows=3
- **Chip definitions** — sortable list of `{key, thumb, color}` rows. Per row: Key, Thumb, CSS, delete button.

Top-level: **Add chip definition** button.

## Public rendering

**File:** [`ui/client/modules/Manifesto/Manifesto.tsx`](../../ui/client/modules/Manifesto/Manifesto.tsx)

```html
<section class="manifesto default">
    <p class="manifesto__body">
        text
        <em class="em-accent">people</em>
        <span class="manifesto__chip" data-chip-key="react">
            <span class="manifesto__chip-thumb" style="background: {chip.color}">{chip.thumb}</span>
            brands
        </span>
        more text
    </p>
    <p class="manifesto__addendum">{addendum}</p>
</section>
```

Both paragraphs are wrapped in `<RevealOnScroll>` (addendum delayed by 120ms).

The token tokenizer is a single-pass regex split: `/(\*[^*]+\*|\{\{chip:[^}]+\}\})/g`. Nested or overlapping forms can't collide.

**Theming tokens consumed (Manifesto.scss):** `--token-font-display` (body), `--token-color-accent` (`.em-accent` and chip thumbs), `--token-color-bg-inset` (default chip thumb bg), surface tokens.

**Italic-accent runs (`*word*`):** **supported on `body`**. Addendum renders verbatim.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-manifesto` |
| Rendered module container (admin + public) | `section-module-row-manifesto` |
| Edit affordance on the section row (admin) | `section-module-edit-manifesto-btn` |
| Primary text input (admin) | `module-editor-primary-text-input` (on Body textarea) |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.Manifesto,
    style: 'default',
    content: {body: m(EItemType.Manifesto)},
    markerText: m(EItemType.Manifesto),
}
```

---

## MCP commands

```bash
cms section add my-page MANIFESTO --sample
cms section add my-page MANIFESTO --content '{"body":"Build *software* for {{chip:p:people}}.","chips":[{"key":"p","thumb":"PEO"}]}'
cms section update <id> --style accent
```

---

## Notes

- A chip token without a matching `chips[]` entry still renders — `LABEL` is the body, `KEY` becomes the thumb. Define chips when you want a custom thumb / background.
- The chip parser uses a non-greedy regex on `{{chip:[^}]+}}`. Avoid `}` characters inside `LABEL`.
- See [`rich-text.md`](rich-text.md) for arbitrary HTML; Manifesto is the right pick when you need a single statement paragraph with inline pill references.
