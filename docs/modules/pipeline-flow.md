# `PipelineFlow` (`EItemType.PipelineFlow`)

> Linear CI/CD or build-pipeline visualisation. Each step renders as a numbered card with label, status pill, meta (timing/hash), and optional notes; arrows between steps are drawn with CSS borders. Dev-portfolio specific.

`item.type`: `PIPELINE_FLOW` &nbsp;·&nbsp; `item.style`: `default` (one of [`EPipelineFlowStyle`](../../ui/client/modules/PipelineFlow/PipelineFlow.types.ts))

---

## Content shape

```ts
{
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    steps?: IPipelineStep[];
    sideNotesLabel?: string;           // mono caps label above the side-notes column
    sideNotes?: string[];              // bullet list rendered alongside the steps
}

interface IPipelineStep {
    label: string;
    status?: string;                   // "ok" | "warn" | "fail" | free-form (drives pill class)
    notes?: string;
    meta?: string;                     // mono duration / commit hash (e.g. "0:42")
}
```

## Styles

| Value | Description |
|---|---|
| `default` | Standard layout |
| `editorial` | Paper / editorial CV variant |

Source: `EPipelineFlowStyle` enum in [`PipelineFlow.types.ts`](../../ui/client/modules/PipelineFlow/PipelineFlow.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/PipelineFlow/PipelineFlowEditor.tsx`](../../ui/admin/modules/PipelineFlow/PipelineFlowEditor.tsx)

Top-level fields: Eyebrow, Title, Subtitle, Side notes label, Side notes (`<TextArea>` newline-separated, rows=4).

**Pipeline steps** (sortable):

- Per step: label, status (`ok | warn | fail`), meta (`0:42`), notes, delete
- **Add step** button

**No `module-editor-primary-text-input`** — registry-omitted, dev-portfolio specific.

## Public rendering

**File:** [`ui/client/modules/PipelineFlow/PipelineFlow.tsx`](../../ui/client/modules/PipelineFlow/PipelineFlow.tsx)

```html
<div class="pipeline-flow default">
    <header class="pipeline-flow__head">
        <div class="pipeline-flow__eyebrow">{eyebrow}</div>
        <h2 class="pipeline-flow__title">{title}</h2>
        <p class="pipeline-flow__subtitle">{subtitle}</p>
    </header>
    <div class="pipeline-flow__body has-side?">
        <ol class="pipeline-flow__steps">
            <li class="pipeline-flow__step">
                <div class="pipeline-flow__step-no">01</div>      <!-- 1-indexed, padded -->
                <div class="pipeline-flow__step-body">
                    <div class="pipeline-flow__step-row">
                        <span class="pipeline-flow__step-label">{label}</span>
                        <span class="pipeline-flow__status pipeline-flow__status--{status}">{status}</span>
                        <span class="pipeline-flow__meta">{meta}</span>
                    </div>
                    <div class="pipeline-flow__step-notes">{notes}</div>
                </div>
            </li>
            <!-- more -->
        </ol>
        <aside class="pipeline-flow__aside">
            <div class="pipeline-flow__sub">{sideNotesLabel}</div>
            <ul><li>{note}</li></ul>
        </aside>
    </div>
</div>
```

Wrapped in `<RevealOnScroll>`. `<h2>` gets an `id` from `slugifyAnchor`. The `has-side` class on `__body` toggles when `sideNotes.length > 0`.

**Theming tokens consumed (PipelineFlow.scss):** status pill colours per variant (`--status--ok`, `--warn`, `--fail`), arrow connector borders, mono meta type, surface tokens.

**Italic-accent runs (`*word*`):** NOT supported.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-pipeline-flow` |
| Rendered module container (admin + public) | `section-module-row-pipeline-flow` |
| Edit affordance on the section row (admin) | `section-module-edit-pipeline-flow-btn` |
| Primary text input (admin) | **not surfaced** — registry-omitted |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

**Omitted from the registry.** Reason: dev-portfolio specific. `REGISTRY_OMISSIONS` in `moduleSamples.ts` lists `EItemType.PipelineFlow`.

---

## MCP commands

```bash
cms section add my-page PIPELINE_FLOW --content '{"title":"CI","steps":[{"label":"Lint","status":"ok","meta":"0:08"},{"label":"Test","status":"ok","meta":"1:24"},{"label":"Build","status":"warn","notes":"Vendor bundle 1.2 MB"}]}'
cms section update <id> --style editorial
```

---

## Notes

- The status value is lowercased and used as a class suffix. `ok` / `warn` / `fail` have predefined colours in SCSS; free-form values still render but inherit the default pill style.
- Step number is auto-derived from array index (`String(i + 1).padStart(2, '0')`) — there's no manual numbering in the content shape.
- Dev-portfolio-specific module — used in CI/CD case studies and engineering write-ups.
