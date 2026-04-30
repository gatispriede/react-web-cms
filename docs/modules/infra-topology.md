# `InfraTopology` (`EItemType.InfraTopology`)

> Infrastructure topology card row + free-form inline SVG diagram. Dev-portfolio specific. Used to show droplet/server cards and a sanitised SVG topology beneath them.

`item.type`: `INFRA_TOPOLOGY` &nbsp;·&nbsp; `item.style`: `default` (one of [`EInfraTopologyStyle`](../../ui/client/modules/InfraTopology/InfraTopology.types.ts))

---

## Content shape

```ts
{
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    dropletsLabel?: string;            // mono caps label above the droplet card grid
    droplets?: IInfraDroplet[];
    topologyLabel?: string;            // mono caps label above the topology SVG
    topologySvg?: string;              // raw SVG markup; sanitised via DOMPurify on render
    topologyCaption?: string;          // free-text caption under the SVG
}

interface IInfraDroplet {
    name: string;
    role?: string;                     // mono caps role label, e.g. "WEB · API"
    specs?: string[];                  // bullet list (e.g. "2 vCPU", "4 GB RAM")
    services?: string[];               // bullet list of services running
    accent?: string;                   // CSS colour for the left border rule
}
```

## Styles

| Value | Description |
|---|---|
| `default` | Standard layout |
| `editorial` | Paper / editorial CV variant |

Source: `EInfraTopologyStyle` enum in [`InfraTopology.types.ts`](../../ui/client/modules/InfraTopology/InfraTopology.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/InfraTopology/InfraTopologyEditor.tsx`](../../ui/admin/modules/InfraTopology/InfraTopologyEditor.tsx)

Top-level fields: Eyebrow, Title, Subtitle, Droplets label, Topology label, Topology SVG (`<TextArea>` rows=6), Topology caption.

**Droplets** (sortable):

- Per droplet: Name, Role (`WEB · API`), Accent (`#color`), delete
- Specs — pipe-separated `<Input>` (`2 vCPU | 4GB RAM` → array)
- Services — pipe-separated `<Input>` (`redis | mongo` → array)

**Add droplet** button.

**No `module-editor-primary-text-input`** — registry-omitted, dev-portfolio specific.

## Public rendering

**File:** [`ui/client/modules/InfraTopology/InfraTopology.tsx`](../../ui/client/modules/InfraTopology/InfraTopology.tsx)

```html
<div class="infra-topology default">
    <header class="infra-topology__head">
        <div class="infra-topology__eyebrow">{eyebrow}</div>
        <h2 class="infra-topology__title">{title}</h2>
        <p class="infra-topology__subtitle">{subtitle}</p>
    </header>
    <div class="infra-topology__droplets-block">
        <div class="infra-topology__sub">{dropletsLabel}</div>
        <div class="infra-topology__droplets">
            <div class="infra-topology__droplet" style="border-left-color: {accent}">
                <div class="infra-topology__droplet-name">{name}</div>
                <div class="infra-topology__droplet-role">{role}</div>
                <ul class="infra-topology__specs"><li>{spec}</li></ul>
                <ul class="infra-topology__services"><li>{service}</li></ul>
            </div>
        </div>
    </div>
    <div class="infra-topology__topology">
        <div class="infra-topology__sub">{topologyLabel}</div>
        <div class="infra-topology__svg"><!-- DOMPurify-sanitised SVG injected via dangerouslySetInnerHTML --></div>
        <p class="infra-topology__caption">{topologyCaption}</p>
    </div>
</div>
```

Wrapped in `<RevealOnScroll>`. `<h2>` gets an `id` from `slugifyAnchor`.

**SVG sanitisation:** `DOMPurify.sanitize(topologySvg, {USE_PROFILES: {svg: true, svgFilters: true}})` — drops `<script>`, event handlers, and `javascript:` URLs while keeping `path` / `circle` / `rect` / `text` / filter elements intact. Any sanitiser failure returns an empty string (no throw).

**Theming tokens consumed (InfraTopology.scss):** card border / accent rule, mono-caps role typography, bullet list colour tokens.

**Italic-accent runs (`*word*`):** NOT supported.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-infra-topology` |
| Rendered module container (admin + public) | `section-module-row-infra-topology` |
| Edit affordance on the section row (admin) | `section-module-edit-infra-topology-btn` |
| Primary text input (admin) | **not surfaced** — registry-omitted |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

**Omitted from the registry.** Reason: dev-portfolio specific. `REGISTRY_OMISSIONS` in `moduleSamples.ts` lists `EItemType.InfraTopology`.

---

## MCP commands

```bash
cms section add my-page INFRA_TOPOLOGY --content '{"title":"Infra","droplets":[{"name":"web-1","role":"WEB · API","specs":["2 vCPU","4 GB RAM"],"services":["nginx","node"]}],"topologySvg":"<svg viewBox=\"0 0 100 100\"><circle cx=\"50\" cy=\"50\" r=\"40\" fill=\"#444\"/></svg>"}'
cms section update <id> --style editorial
```

---

## Notes

- **SVG is sanitised, not arbitrary HTML.** Authors paste raw `<svg>...</svg>` markup; DOMPurify keeps the SVG profile but strips anything script-like.
- Specs and services are stored as `string[]` — the editor uses pipe-separated text input as a UX shortcut. Either trim spaces or accept the bundled-with-spaces form (the renderer doesn't care).
- Dev-portfolio-specific module — used to illustrate hosting topology in case studies.
