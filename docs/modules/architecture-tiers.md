# `ArchitectureTiers` (`EItemType.ArchitectureTiers`)

> Three-up tier cards (A.01 / A.02 / A.03), an optional `shared/` contract footer card, and an optional A.04 request-lifecycle row of step pills. Mirrors the `§ A · Architecture` block from the v2 paper dossiers. Dev-portfolio specific.

`item.type`: `ARCHITECTURE_TIERS` &nbsp;·&nbsp; `item.style`: `default` (one of [`EArchitectureTiersStyle`](../../ui/client/modules/ArchitectureTiers/ArchitectureTiers.types.ts))

---

## Content shape

```ts
{
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    intro?: string;                    // "Design aim" intro paragraph above the tier row
    tiers: IArchitectureTier[];        // three (or fewer) tier cards
    sharedTitle?: string;              // optional shared/contract footer card
    sharedDescription?: string;
    sharedPills?: string[];
    lifecycleLabel?: string;           // "A.04 · Request lifecycle"
    lifecycleNote?: string;
    lifecycleSteps?: IArchitectureLifecycleStep[];
}

interface IArchitectureTier {
    ord?: string;                      // ordinal label, e.g. "A.01"
    concern?: string;                  // top-right concern label, e.g. "RENDER CONCERN"
    role?: string;                     // optional role caption (LSS-specific)
    title: string;                     // big mono title, e.g. "ui/client/"
    description?: string;
    pills?: string[];                  // tag/feature pills row
    modules?: Array<{label: string; tag?: string}>;   // table of inner modules
}

interface IArchitectureLifecycleStep {
    n: string;                         // step number, e.g. "01"
    title: string;
    sub?: string;
    highlight?: boolean;               // highlight with the accent fill
}
```

## Styles

| Value | Description |
|---|---|
| `default` | Standard layout |
| `editorial` | Paper / editorial CV variant |

Source: `EArchitectureTiersStyle` enum in [`ArchitectureTiers.types.ts`](../../ui/client/modules/ArchitectureTiers/ArchitectureTiers.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/ArchitectureTiers/ArchitectureTiersEditor.tsx`](../../ui/admin/modules/ArchitectureTiers/ArchitectureTiersEditor.tsx)

Stub-level editor — top-level identity fields are exposed as inputs; the rest (tiers / shared / lifecycle) is edited as JSON in a `<TextArea>`:

- **Eyebrow** — `<Input>`
- **Title** — `<Input>`
- **Subtitle** — `<Input>`
- **Intro paragraph** — `<TextArea>` rows=3
- **Tiers / shared / lifecycle (JSON)** — `<TextArea>` rows=14, parses on every change; only commits if the JSON is valid (bad JSON keeps the previous content)

The editor commit is via `defaultValue` so typing doesn't lose focus on every keystroke.

**No `module-editor-primary-text-input`** — registry-omitted, dev-portfolio specific.

## Public rendering

**File:** [`ui/client/modules/ArchitectureTiers/ArchitectureTiers.tsx`](../../ui/client/modules/ArchitectureTiers/ArchitectureTiers.tsx)

```html
<div class="arch-tiers default">
    <header class="arch-tiers__head">...</header>
    <div class="arch-tiers__intro">
        <div class="arch-tiers__intro-label">DESIGN AIM</div>
        <div class="arch-tiers__intro-body">{intro}</div>
    </div>
    <div class="arch-tiers__row">
        <div class="arch-tiers__card">
            <div class="arch-tiers__card-head">
                <span class="arch-tiers__ord">{ord}</span>
                <span class="arch-tiers__concern">{concern}</span>
            </div>
            <div class="arch-tiers__role">{role}</div>
            <div class="arch-tiers__card-title">{title}</div>
            <p class="arch-tiers__card-desc">{description}</p>
            <div class="arch-tiers__pills">
                <span class="arch-tiers__pill">{pill}</span>
            </div>
            <ul class="arch-tiers__modules">
                <li><b>{module.label}</b> <span class="arch-tiers__module-tag">{module.tag}</span></li>
            </ul>
        </div>
    </div>
    <div class="arch-tiers__shared">
        <div class="arch-tiers__shared-title">{sharedTitle}</div>
        <div class="arch-tiers__shared-desc">{sharedDescription}</div>
        <div class="arch-tiers__pills">{sharedPills}</div>
    </div>
    <div class="arch-tiers__lifecycle">
        <div class="arch-tiers__lifecycle-head">
            <div class="arch-tiers__lifecycle-label">{lifecycleLabel}</div>
            <div class="arch-tiers__lifecycle-note">{lifecycleNote}</div>
        </div>
        <div class="arch-tiers__lifecycle-rail">
            <div class="arch-tiers__lifecycle-step is-hl?">
                <div class="arch-tiers__lifecycle-n">{n}</div>
                <div class="arch-tiers__lifecycle-title">{title}</div>
                <div class="arch-tiers__lifecycle-sub">{sub}</div>
            </div>
        </div>
    </div>
</div>
```

Wrapped in `<RevealOnScroll>`. The `<h2>` heading gets an `id` from `slugifyAnchor`. Each section (intro / row / shared / lifecycle) is conditionally rendered.

**Theming tokens consumed (ArchitectureTiers.scss):** card surface, accent rule top, mono ordinal type, pill colours, lifecycle step highlight (accent fill).

**Italic-accent runs (`*word*`):** NOT supported.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-architecture-tiers` |
| Rendered module container (admin + public) | `section-module-row-architecture-tiers` |
| Edit affordance on the section row (admin) | `section-module-edit-architecture-tiers-btn` |
| Primary text input (admin) | **not surfaced** — registry-omitted |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

**Omitted from the registry.** Reason: dev-portfolio specific. `REGISTRY_OMISSIONS` in `moduleSamples.ts` lists `EItemType.ArchitectureTiers`.

---

## MCP commands

```bash
cms section add my-page ARCHITECTURE_TIERS --content '{"title":"§ A · Architecture","intro":"Three concerns, three boundaries.","tiers":[{"ord":"A.01","concern":"RENDER","title":"ui/client/","description":"Public-facing render","pills":["Next.js 15","React 19","SSG"]},{"ord":"A.02","concern":"AUTHOR","title":"ui/admin/","pills":["antd","CKEditor"]},{"ord":"A.03","concern":"DATA","title":"services/","pills":["GraphQL","Mongo"]}]}'
cms section update <id> --style editorial
```

---

## Notes

- The editor's JSON textarea is intentionally stub-level — graduating to a structured form is queued. Authoring through bundle generators or MCP is the expected path today.
- The intro label `"DESIGN AIM"` is hard-coded in the renderer (not driven by content). If you need a different label, fork the SCSS / component or use a different module.
- Dev-portfolio-specific module — mirrors the v2 paper dossiers (Portfolio - CMS.html / Portfolio - LSS.html `§ A · Architecture` block).
