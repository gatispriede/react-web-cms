# `Services` (`EItemType.Services`)

> A list of practice areas / services. Each row has a number, title, description, and optional CTA, icon glyph, and tag chips. Used for the "What I do" section.

`item.type`: `SERVICES` &nbsp;·&nbsp; `item.style`: `default` (one of [`EServicesStyle`](../../ui/client/modules/Services/Services.types.ts))

---

## Content shape

```ts
{
    sectionNumber?: string;            // small mono label above the title (e.g. "§ 03")
    sectionTitle?: string;             // display heading; supports `*italic-accent*`
    sectionSubtitle?: string;          // short blurb to the right of the title
    rows: IServiceRow[];
}

interface IServiceRow {
    number: string;                    // required — row ordinal ("01", "02", ...)
    title: string;                     // required — supports `*italic-accent*`
    description: string;               // required — supporting paragraph
    ctaLabel?: string;                 // "Find out more" CTA label
    ctaHref?: string;                  // CTA link; if absent, ctaLabel renders as plain text
    iconGlyph?: string;                // single emoji/glyph for the grid-style icon square
    tags?: string[];                   // chip row (grid-style only)
}
```

## Styles

| Value | Description |
|---|---|
| `default` | Standard rows |
| `numbered` | design-v2 "What I do" — large numbered rows |
| `grid` | 3-col card grid with icon + tag chips (Industrial) |
| `cards` | 3-col grid with serif title + hover-invert (Brandappart) |
| `tiers` | Architecture-tier columns — wider cards, accent rule top, "FLOW →" caption between cells |

Source: `EServicesStyle` enum in [`Services.types.ts`](../../ui/client/modules/Services/Services.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/Services/ServicesEditor.tsx`](../../ui/admin/modules/Services/ServicesEditor.tsx)

Top-level fields:

- **Section number** — `<Input>` placeholder `§ 03`
- **Section title** — `<Input>` placeholder `What I *do.*` &nbsp;·&nbsp; supports `*italic-accent*` markup (hint shown under the field)
- **Section subtitle** — `<Input>` placeholder `Four practices, one studio.`

Each row card (sortable by drag handle):

- **Number** — `<Input>` (small)
- **Title** — `<LabeledInput>` placeholder `Solutions *architecture*` &nbsp;·&nbsp; **first row only** carries `data-testid="module-editor-primary-text-input"`
- **Description** — `<TextArea>` rows=2
- **CTA + Link** — paired `<LabeledInput>`s
- **Icon glyph + Tags (comma-sep)** — paired `<LabeledInput>`s

Top-level: **Add service row** button (dashed, full-width).

## Public rendering

**File:** [`ui/client/modules/Services/Services.tsx`](../../ui/client/modules/Services/Services.tsx)

```html
<section class="services-module default">
    <header class="services-module__head">
        <div class="services-module__num">{sectionNumber}</div>
        <h2 class="services-module__title">{sectionTitle (with em.em-accent runs)}</h2>
        <div class="services-module__sub">{sectionSubtitle}</div>
    </header>
    <div class="services-module__rows">
        <div class="services-module__row">
            <div class="services-module__row-icon">{iconGlyph}</div>
            <div class="services-module__row-num">{number}</div>
            <h3 class="services-module__row-title">{title}</h3>
            <div class="services-module__row-desc">{description}</div>
            <div class="services-module__row-tags">
                <span class="services-module__tag">{tag}</span>
            </div>
            <div class="services-module__row-cta">
                <a href="{ctaHref}">{ctaLabel} <span class="services-module__arr">→</span></a>
            </div>
        </div>
        <!-- more rows -->
    </div>
</section>
```

`<h2>` and each row `<h3>` get an `id` from `slugifyAnchor()` for deep-link anchors.

**Theming tokens consumed (Services.scss):** `--token-color-accent`, `--token-color-text`, `--token-color-border`, typography tokens. `.em-accent` style is theme-driven.

**Italic-accent runs (`*word*`):** supported on **`sectionTitle`** and **each `row.title`**. `*word*` → `<em class="em-accent">word</em>`. Description does NOT process accent runs.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-services` |
| Rendered module container (admin + public) | `section-module-row-services` |
| Edit affordance on the section row (admin) | `section-module-edit-services-btn` |
| Primary text input (admin) | `module-editor-primary-text-input` (on the **first row's** Title) |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.Services,
    style: 'default',
    content: {
        rows: [
            {number: '01', title: m(EItemType.Services), description: 'sample description'},
        ],
    },
    markerText: m(EItemType.Services),
}
```

---

## MCP commands

```bash
cms section add my-page SERVICES --sample
cms section add my-page SERVICES --content '{"sectionTitle":"What I *do.*","rows":[{"number":"01","title":"Solutions *architecture*","description":"Cloud and on-prem systems"}]}'
cms section update <id> --style grid
```

`cms module describe SERVICES` returns the content schema + style enum + sample as JSON.

---

## Notes

- `iconGlyph` and `tags` only render in `grid` style. They're harmless on other styles (silently ignored).
- A row with `ctaLabel` but no `ctaHref` renders as plain text (no nav).
- See also [`testimonials.md`](testimonials.md) and [`project-grid.md`](project-grid.md) — they share the `*italic-accent*` convention on their section titles.
