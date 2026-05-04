# `Hero` (`EItemType.Hero`)

> Page-leading banner: headline + subtitle + tagline + optional portrait, CTAs, and meta strip. The most visually-loaded module — every page typically has at most one.

`item.type`: `HERO` &nbsp;·&nbsp; `item.style`: `default` (one of [`EHeroStyle`](../../ui/client/modules/Hero/Hero.types.ts))

---

## Content shape

`IItem.content` for `HERO` is a JSON-stringified object:

```ts
{
    eyebrow?: string;                  // small-caps label above the headline
    headline: string;                  // required — primary headline
    headlineSoft?: string;             // italic / soft second line
    titles?: string[];                 // A / B / C separator row
    subtitle: string;                  // prose subtitle (empty string is fine)
    tagline: string;                   // italic tagline
    taglineAttribution?: string;       // attribution below tagline ("— personal motto")
    bgImage: string;                   // CSS background image URL (empty = no bg)
    accent: string;                    // accent color hex
    portraitLabel?: string;            // short label inside the portrait placeholder ("GP")
    portraitImage?: string;            // override the placeholder with a real image URL
    meta?: IHeroMeta[];                // definition-list pairs {label, value}
    coords?: IHeroCoord[];             // {label, value, liveTime?} — liveTime: true renders Europe/Riga current time
    ctaPrimary?: IHeroCta;             // {label, href?, primary?}
    ctaSecondary?: IHeroCta;
    ctaTertiary?: IHeroCta;
}
```

Markup helpers in `headline` / `subtitle` / `tagline`:
- `*word*` → `<em class="em-accent">word</em>` (theme-styled italic accent)

Full type definitions live at [`ui/client/modules/Hero/Hero.types.ts`](../../ui/client/modules/Hero/Hero.types.ts).

## Styles

| Value | Description |
|---|---|
| `default` | Standard layout — headline left, optional portrait right |
| `centered` | Headline centered, portrait suppressed; meta below |
| `compact` | Reduced vertical rhythm — for pages with multiple stacked sections |
| `editorial` | Magazine-style: large display headline, restrained meta |
| `card-on-photo` | White display headline on a semi-opaque dark card over the bgImage |

Source: `EHeroStyle` enum at the bottom of [`Hero.types.ts`](../../ui/client/modules/Hero/Hero.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/Hero/HeroEditor.tsx`](../../ui/admin/modules/Hero/HeroEditor.tsx)

Fields exposed (top-to-bottom in the Drawer):

- **Headline** — `<Input>` &nbsp;·&nbsp; carries `data-testid="module-editor-primary-text-input"`
- **Eyebrow** — `<Input>` (optional)
- **Headline soft** — `<Input>` (optional)
- **Subtitle** — `<TextArea>`
- **Tagline** — `<Input>`
- **Tagline attribution** — `<Input>` (optional)
- **Background image URL** — `<Input>` + dropzone via `<ImageDropTarget>` (paste, drag-drop OS file, or pick existing asset)
- **Accent color** — `<ColorPicker>`
- **Portrait label** — `<Input>` (max ~3 chars)
- **Portrait image** — same dropzone shape as background
- **Meta strip** — repeating `{label, value}` rows
- **Coords strip** — repeating `{label, value, liveTime?}` rows
- **CTAs** — primary / secondary / tertiary, each `{label, href?, primary?}`

Validation: empty headline blocks save; URL fields don't enforce protocol but render as-is.

## Public rendering

**File:** [`ui/client/modules/Hero/Hero.tsx`](../../ui/client/modules/Hero/Hero.tsx)

HTML structure (simplified):

```html
<section class="module-hero hero-style-default" style="--accent: #888888; --hero-bg: url(...)">
    <div class="hero-eyebrow">{eyebrow}</div>
    <h1 class="hero-headline">{headline}</h1>
    <p class="hero-subtitle">{subtitle}</p>
    <p class="hero-tagline">{tagline}</p>
    <dl class="hero-meta">{...meta items}</dl>
    <div class="hero-coords">{...coord items}</div>
    <div class="hero-ctas">{...cta buttons}</div>
    <div class="hero-portrait">{portrait}</div>
</section>
```

**Theming tokens consumed (Hero.scss):** `--token-color-accent`, `--token-color-text`, `--token-color-text-muted`, `--token-color-bg`, `--token-font-display`, `--token-font-body`, `--token-radius-md`. `accent` from content overrides `--accent` per-instance.

**Italic-accent runs:** all three of headline / subtitle / tagline pass through `renderAccentRuns`. `*word*` → `<em class="em-accent">word</em>`.

**`liveTime`:** when any `coords[i].liveTime === true`, that coord's value is replaced at render with the current `Europe/Riga` time, refreshed every second on the client.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-hero` |
| Rendered module container (admin + public) | `section-module-row-hero` |
| Edit affordance on the section row (admin) | `section-module-edit-hero-btn` |
| Primary text input (admin) | `module-editor-primary-text-input` (on the Headline field) |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.Hero,
    style: 'default',
    content: {
        headline: m(EItemType.Hero),    // unique marker per run
        subtitle: 'sample subtitle',
        tagline: 'sample tagline',
        bgImage: '',
        accent: '#888888',
    },
    markerText: m(EItemType.Hero),
}
```

---

## MCP commands

```bash
# Add a Hero with the default sample content
cms section add my-page HERO --sample

# Add with custom content
cms section add my-page HERO --content '{"headline":"Welcome","subtitle":"Tagline goes here","tagline":"a quote","bgImage":"","accent":"#7c3aed"}'

# Switch to a different style without rewriting content
cms section update <id> --style centered
```

`cms module describe HERO` returns the content schema (above) + style enum + sample as JSON.

---

## Notes

- **One Hero per page** is the convention. Multiple Heroes on a single page render but visually compete; the admin doesn't enforce a limit.
- **Background image** can be any CSS background value, not just `url(...)`. Linear gradients work directly.
- **`portrait*` fields** layer with `bgImage` — if both are present, the portrait sits on top.
- **CTAs without `href`** render as plain `<button>` (no nav). Useful for "Coming soon" or scroll-into-view targets the module's `action` prop hooks.
