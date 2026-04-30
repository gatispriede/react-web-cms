# `DataModel` (`EItemType.DataModel`)

> Schema visualiser for the CMS case-study page. Renders a fields table on the left, a collections side panel on the right, and a 3-up audit/notes card row underneath. Dev-portfolio specific.

`item.type`: `DATA_MODEL` &nbsp;·&nbsp; `item.style`: `default` (one of [`EDataModelStyle`](../../ui/client/modules/DataModel/DataModel.types.ts))

---

## Content shape

```ts
{
    eyebrow?: string;                  // mono caps eyebrow (e.g. "§ 04 · DATA MODEL")
    title?: string;
    subtitle?: string;
    tableTitle?: string;               // heading above the fields table
    fields?: IDataModelField[];
    collectionsTitle?: string;         // heading above the collections side panel
    collections?: IDataModelCollection[];
    asideNote?: string;                // free-text aside under the collections list
    audits?: IDataModelAudit[];        // 3-up audit cards below the body
}

interface IDataModelField {
    name: string;
    type: string;
    nullable?: string;                 // "yes" / "no" / "fk" — drives small mono pill class
    notes?: string;
}

interface IDataModelCollection {
    name: string;
    count?: string;                    // "1.2k rows" or similar
}

interface IDataModelAudit {
    title: string;
    body: string;
    tag?: string;                      // mono caps tag above the title
}
```

## Styles

| Value | Description |
|---|---|
| `default` | Standard layout |
| `editorial` | Paper / editorial CV — dashed rules, mono labels |

Source: `EDataModelStyle` enum in [`DataModel.types.ts`](../../ui/client/modules/DataModel/DataModel.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/DataModel/DataModelEditor.tsx`](../../ui/admin/modules/DataModel/DataModelEditor.tsx)

Top-level fields: Eyebrow, Title, Subtitle, Table title, Collections title, Aside note (`<TextArea>` rows=2).

**Fields** (sortable): per row — name, type, nullable (`no/yes/fk`), notes, delete. **Add field** button.

**Collections** (sortable): per row — name, count, delete. **Add collection** button.

**Audit cards** (sortable): per row — tag, title, body, delete. **Add audit card** button.

**No `module-editor-primary-text-input`** — the editor doesn't tag any field as primary; this module is registry-omitted from the e2e chain (dev-portfolio specific) so the testid isn't required.

## Public rendering

**File:** [`ui/client/modules/DataModel/DataModel.tsx`](../../ui/client/modules/DataModel/DataModel.tsx)

```html
<div class="data-model default">
    <header class="data-model__head">
        <div class="data-model__eyebrow">{eyebrow}</div>
        <h2 class="data-model__title">{title}</h2>
        <p class="data-model__subtitle">{subtitle}</p>
    </header>
    <div class="data-model__body">
        <div class="data-model__table-wrap">
            <div class="data-model__sub">{tableTitle}</div>
            <table class="data-model__table">
                <thead><tr><th>field</th><th>type</th><th>nullable</th><th>notes</th></tr></thead>
                <tbody>
                    <tr>
                        <td><code>{name}</code></td>
                        <td><span class="data-model__type">{type}</span></td>
                        <td><span class="data-model__pill data-model__pill--{nullable}">{nullable || '—'}</span></td>
                        <td>{notes}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <aside class="data-model__aside">
            <div class="data-model__sub">{collectionsTitle}</div>
            <ul class="data-model__collections">
                <li>
                    <span class="data-model__col-name">{name}</span>
                    <span class="data-model__col-count">{count}</span>
                </li>
            </ul>
            <p class="data-model__aside-note">{asideNote}</p>
        </aside>
    </div>
    <div class="data-model__audits">
        <div class="data-model__audit">
            <div class="data-model__audit-tag">{tag}</div>
            <div class="data-model__audit-title">{title}</div>
            <div class="data-model__audit-body">{body}</div>
        </div>
    </div>
</div>
```

Wrapped in `<RevealOnScroll>`. `<h2>` gets an `id` from `slugifyAnchor`.

**Theming tokens consumed (DataModel.scss):** mono / serif type pairing, accent pill colours per nullable variant, table row borders, surface tokens.

**Italic-accent runs (`*word*`):** NOT supported.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-data-model` |
| Rendered module container (admin + public) | `section-module-row-data-model` |
| Edit affordance on the section row (admin) | `section-module-edit-data-model-btn` |
| Primary text input (admin) | **not surfaced** — registry-omitted, e2e chain skips |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

**Omitted from the registry.** Reason: dev-portfolio specific — the data-model visualisation is purpose-built for the CMS case-study page and isn't representative content for a generic site. `REGISTRY_OMISSIONS` in `moduleSamples.ts` lists `EItemType.DataModel`.

---

## MCP commands

```bash
cms section add my-page DATA_MODEL --content '{"title":"Schema","tableTitle":"items","fields":[{"name":"id","type":"ObjectId","nullable":"no"},{"name":"slug","type":"string","nullable":"no"},{"name":"parent","type":"ObjectId","nullable":"fk","notes":"FK → pages"}]}'
cms section update <id> --style editorial
```

`cms module describe DATA_MODEL` returns the content schema + style enum (no sample).

---

## Notes

- The `nullable` value is lowercased and used as a class suffix: `data-model__pill--yes` / `--no` / `--fk`. Free-form values still render but won't pick up the predefined pill colours.
- The audit card row is the "notes / decisions" rail next to the schema. Each card is its own `<div class="data-model__audit">` — they don't auto-arrange beyond CSS grid layout.
- Dev-portfolio-specific module — used in the CMS case-study page and similar long-form engineering write-ups.
