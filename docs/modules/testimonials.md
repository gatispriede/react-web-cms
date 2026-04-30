# `Testimonials` (`EItemType.Testimonials`)

> Pull-quote testimonials with name, role, and avatar initial. One-up list or 3-col card grid.

`item.type`: `TESTIMONIALS` &nbsp;·&nbsp; `item.style`: `default` (one of [`ETestimonialsStyle`](../../ui/client/modules/Testimonials/Testimonials.types.ts))

---

## Content shape

```ts
{
    sectionTitle?: string;             // display heading; supports `*italic-accent*`
    sectionSubtitle?: string;          // right-column blurb on wide viewports
    items: ITestimonial[];
}

interface ITestimonial {
    quote: string;                     // required — the testimonial body
    name: string;                      // required — quoted person
    role?: string;                     // "Founder · SciChart"
    avatarInitial?: string;            // single-letter avatar (defaults to name[0])
}
```

## Styles

| Value | Description |
|---|---|
| `default` | Stacked cards |
| `cards` | 3-col grid (design-v2) |

Source: `ETestimonialsStyle` enum in [`Testimonials.types.ts`](../../ui/client/modules/Testimonials/Testimonials.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/Testimonials/TestimonialsEditor.tsx`](../../ui/admin/modules/Testimonials/TestimonialsEditor.tsx)

Top-level:

- **Section title** — `<Input>` placeholder `Stories worth *shipping.*` &nbsp;·&nbsp; supports `*italic-accent*`
- **Section subtitle** — `<TextArea>` rows=2

Each testimonial card (sortable by drag handle):

- **Quote** — `<TextArea>` rows=3 &nbsp;·&nbsp; **first item only** carries `data-testid="module-editor-primary-text-input"`
- **Name + Role** — paired `<LabeledInput>`s
- **Avatar initial** — `<Input>` (defaults to first letter of name)

Top-level: **Add testimonial** button.

## Public rendering

**File:** [`ui/client/modules/Testimonials/Testimonials.tsx`](../../ui/client/modules/Testimonials/Testimonials.tsx)

```html
<section class="testimonials-module default">
    <header class="testimonials-module__head">
        <h2 class="testimonials-module__title">{sectionTitle (with em.em-accent)}</h2>
        <div class="testimonials-module__sub">{sectionSubtitle}</div>
    </header>
    <div class="testimonials-module__grid">
        <div class="testimonials-module__card">
            <blockquote class="testimonials-module__quote">{quote}</blockquote>
            <div class="testimonials-module__who">
                <div class="testimonials-module__avatar">{(avatarInitial || name[0]).toUpperCase()}</div>
                <div>
                    <div class="testimonials-module__name">{name}</div>
                    <div class="testimonials-module__role">{role}</div>
                </div>
            </div>
        </div>
        <!-- more -->
    </div>
</section>
```

Each card wrapped in `<RevealOnScroll>` with staggered delay (`i * 80ms`).

**Theming tokens consumed (Testimonials.scss):** typography tokens, `--token-color-accent` (avatar bg), surface / border tokens.

**Italic-accent runs (`*word*`):** supported on **`sectionTitle`** only. Quote bodies render verbatim through `<InlineTranslatable>`.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-testimonials` |
| Rendered module container (admin + public) | `section-module-row-testimonials` |
| Edit affordance on the section row (admin) | `section-module-edit-testimonials-btn` |
| Primary text input (admin) | `module-editor-primary-text-input` (on the **first item's** Quote) |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.Testimonials,
    style: 'default',
    content: {
        items: [{quote: m(EItemType.Testimonials), name: 'sample name'}],
    },
    markerText: m(EItemType.Testimonials),
}
```

---

## MCP commands

```bash
cms section add my-page TESTIMONIALS --sample
cms section add my-page TESTIMONIALS --content '{"items":[{"quote":"Great work","name":"Andrew","role":"Founder"}]}'
cms section update <id> --style cards
```

`cms module describe TESTIMONIALS` returns the content schema + style enum + sample as JSON.

---

## Notes

- `avatarInitial` is uppercased on render. If absent, `name[0]?.toUpperCase()` is used.
- An empty `name` with a missing `avatarInitial` renders an empty avatar circle — a real-content guardrail (no broken `<img>` fallback).
