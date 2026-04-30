# `RepoTree` (`EItemType.RepoTree`)

> Interactive repository structure viewer. Tree column on the left, detail pane on the right. Dev-portfolio specific. Used to walk visitors through codebase organisation in case studies.

`item.type`: `REPO_TREE` &nbsp;·&nbsp; `item.style`: `default` (one of [`ERepoTreeStyle`](../../ui/client/modules/RepoTree/RepoTree.types.ts))

---

## Content shape

```ts
{
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    treeLabel?: string;                // mono caps label above the tree column
    nodes?: IRepoNode[];               // flat list — hierarchy derived from each node's path
}

interface IRepoNode {
    path: string;                      // canonical id, slash-separated (e.g. "ui/client/modules/Hero")
    kind: 'dir' | 'file';
    summary?: string;                  // one-liner shown next to the node label in the tree
    body?: string;                     // long-form description in the right detail pane
    tag?: string;                      // mono caps tag in the detail pane
    badge?: string;                    // display badge for dir nodes (e.g. "BACKEND")
    stats?: {subfolders: number; files: number; maxDepth: number};
}
```

The hierarchy is computed at render time: each node's `path` is split on `/` to derive depth and parent. Sorted with directories before files at each level, then alphabetical by leaf name.

## Styles

| Value | Description |
|---|---|
| `default` | Standard layout |
| `editorial` | Paper / editorial CV variant |

Source: `ERepoTreeStyle` enum in [`RepoTree.types.ts`](../../ui/client/modules/RepoTree/RepoTree.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/RepoTree/RepoTreeEditor.tsx`](../../ui/admin/modules/RepoTree/RepoTreeEditor.tsx)

Top-level fields: Eyebrow, Title, Subtitle, Tree column label.

**Nodes** (sortable):

- Per node: path (`ui/client/modules/Hero`), kind (`dir | file` `<Select>`), tag, delete
- Summary `<Input>` (one-liner) and Body `<TextArea>` rows=2

**Add node** button.

The editor doesn't expose `badge` or `stats` directly — those are populated by the bundle generator for dir nodes (CLI tooling). Authoring via MCP preserves them on round-trip.

**No `module-editor-primary-text-input`** — registry-omitted, dev-portfolio specific.

## Public rendering

**File:** [`ui/client/modules/RepoTree/RepoTree.tsx`](../../ui/client/modules/RepoTree/RepoTree.tsx)

```html
<div class="repo-tree default">
    <header class="repo-tree__head">...</header>
    <div class="repo-tree__body">
        <div class="repo-tree__col-tree">
            <div class="repo-tree__sub">{treeLabel}</div>
            <div class="repo-tree__scroll">
                <ul class="repo-tree__nodes">
                    <li>
                        <button class="repo-tree__node repo-tree__node--dir is-active?" style="padding-left: {8 + depth * 14}px" aria-expanded="...">
                            <span class="repo-tree__node-icon">▾ / ▸ / ·</span>
                            <span class="repo-tree__node-label">{leaf}</span>
                            <span class="repo-tree__node-summary">{summary}</span>
                        </button>
                        <ul class="repo-tree__nodes repo-tree__nodes--nested"><!-- children when open --></ul>
                    </li>
                </ul>
            </div>
        </div>
        <div class="repo-tree__col-detail">
            <div class="repo-tree__detail-card">
                <div class="repo-tree__crumb">...</div>
                <h3 class="repo-tree__detail-title">{leaf}{kind === 'dir' ? '/' : ''}</h3>
                <div class="repo-tree__detail-badge">...</div>
                <p class="repo-tree__detail-body">{body}</p>
                <div class="repo-tree__stats">{subfolders / files / maxDepth / depth here}</div>
                <ul class="repo-tree__children"><!-- direct children of selected dir --></ul>
            </div>
        </div>
    </div>
</div>
```

Default expansion: every directory at depth ≤ 2 is expanded; deeper folders stay collapsed but toggleable. Selecting a dir node also toggles its expansion. The first node is selected by default.

Wrapped in `<RevealOnScroll>`. The `<h2>` heading gets an `id` from `slugifyAnchor`.

**Theming tokens consumed (RepoTree.scss):** mono path typography, accent (active node), tree indent rule, detail card surface tokens.

**Italic-accent runs (`*word*`):** NOT supported.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-repo-tree` |
| Rendered module container (admin + public) | `section-module-row-repo-tree` |
| Edit affordance on the section row (admin) | `section-module-edit-repo-tree-btn` |
| Primary text input (admin) | **not surfaced** — registry-omitted |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

**Omitted from the registry.** Reason: dev-portfolio specific. `REGISTRY_OMISSIONS` in `moduleSamples.ts` lists `EItemType.RepoTree`.

---

## MCP commands

```bash
cms section add my-page REPO_TREE --content '{"title":"Codebase","nodes":[{"path":"ui","kind":"dir","summary":"frontend","badge":"FRONTEND"},{"path":"ui/client","kind":"dir","summary":"public render"},{"path":"services","kind":"dir","summary":"backend","badge":"BACKEND"}]}'
cms section update <id> --style editorial
```

---

## Notes

- **Hierarchy is path-derived.** A node whose `path` parent isn't in the list is surfaced at the top level (orphan handling) rather than dropped.
- **Sort order is deterministic** (dirs first, alphabetical) regardless of the order `nodes[]` is authored in.
- The `body` field renders in the detail pane as a single `<p>` — for multi-paragraph descriptions, use Manifesto or RichText alongside.
- Dev-portfolio-specific module — used in case-study pages to walk visitors through codebase organisation.
