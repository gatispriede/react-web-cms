---
name: admin-inline-editing
description: Sanity-Presentation-style click-to-edit overlay on the admin preview iframe. Click rendered content → jump to the matching editor field. Uses data-edit-target attributes baked into the public render.
research: see research-findings-2026-05-12.md §1 Inline / contextual editing
---

# Click-to-edit overlay on admin preview

## Status — SHIPPED 2026-05-14

The `data-edit-target` round-trip is closed. **As-built diverges from the original spec in one structural way:** there is no preview *iframe*. The admin build view (`/admin/build`) renders the public page **in-place** in the same document as the admin shell, so the cross-document `postMessage` bridge the spec describes (`inlinePreviewClickBridge.ts`, `targetOrigin` checks, `?__preview=1` handshake) is unnecessary — `useInlineEdit` attaches document-level capture listeners directly. The contract itself (the `data-edit-target` attribute string, parse/format, dispatch-by-collection) landed as designed.

**What already existed (prior passes):**
- `shared/types/InlineEdit.ts` — the `<collection>/<id>/<field>` wire contract + `formatInlineEditTarget` / `parseInlineEditTarget`.
- `ui/client/lib/inlineEditAttr.ts` — the `inlineEditAttr(admin, id, field, collection)` helper; **already called across all ~24 public modules** (Hero, Manifesto, Gallery, Timeline, Stats, Testimonials, ProjectGrid, Services, SocialLinks, RichText, PlainText, BlogFeed, …) and `SectionContent.tsx` emits `data-edit-section` on every section root.
- `ui/admin/shell/InlineEdit/` — the overlay scaffolding: `useInlineEdit` (hover + click capture listeners), `InlineEditHighlight` (outline + field pill), `InlineEditDrawer` (in-place quick-edit textarea), `InlineEditOverlay` (mounted once in `AdminApp`, persists module text via `SectionApi.addRemoveSectionItem`), `editTargetRoute.ts` (the **pure** resolver — `resolveEditTarget` / `buildFocusQuery` / `dispatchLabel`).

**The gap this jump closed — the round-trip was open:** `InlineEditOverlay` imported `resolveEditTarget` + `dispatchLabel` but **never called them**. Every click — whatever the collection — just opened the drawer; `pages` / `posts` / `products` clicks did nothing useful (the drawer's own `handleSave` throws "not wired yet" for non-`modules`). What landed:
1. **`ui/admin/shell/InlineEdit/editTargetNavigate.ts` (new)** — the impure navigation half. `navigateToEditTarget(target)` resolves + (for `kind:'route'`) `window.location.assign`s the deep-link; `navigateToFullEditor(target)` is the drawer's escape-hatch navigation. Kept separate so `editTargetRoute.ts` stays DOM-free + unit-testable.
2. **`InlineEditOverlay`** now dispatches on click: a `useEffect` watching `active` resolves the target — `modules`/`sections` leave the drawer to open in-place; `pages`/`posts`/`products` fire `navigateToEditTarget` (deep-link to `/admin/build` / `/admin/content/posts` / `/admin/content/products` with `?focus=<field>` + `?editId=<id>` threaded) and `clearActive()` so the drawer never flashes. A toast (`notifyInfo`) announces the navigation.
3. **`editTargetRoute.ts`** — `modules`/`sections` dispatch now carries a `fullEditorHref` (build view + `?editId`/`?focus`) instead of bare `{kind:'drawer'}`, so compound fields the textarea can't handle (image/link pickers, list reorder) have an escape hatch.
4. **`InlineEditDrawer`** — new `onOpenFullEditor` prop renders an **"Open full editor"** link-button (`data-testid="inline-edit-drawer-open-full-editor-button"`) in the footer, shown only when the resolved dispatch has a `fullEditorHref`.
5. i18n — `Open full editor` / `Opening {{label}}…` added to `en.json` + `lv.json`.

**Deferred (per-feature follow-ups, all under `ui/admin/features/*` — owned by other agents):** the destination panes consuming `?focus=` / `?editId=` to scroll + focus the matching input on mount. The round-trip is closed **up to the route boundary** — the click now lands the operator on the right pane with the field hints in the URL; each pane wiring `useEffect` on `router.query.focus` is mechanical and pane-local. Also deferred: drawer-side persistence for non-`modules` collections (`handleSave` still throws "not wired yet" for `pages`/`posts`/`products` — those collections route to their full editor instead, which is the correct surface for them anyway).

**MCP coverage:** N/A — this item adds no new editable *field*; it is a navigation/dispatch layer over content surfaces that already have MCP write paths (`section.update` / `module.*` / `post.upsert` / `product.update`). Exempt per universal-requirement #2 (no new editable surface).

---

## Goal

Adopt the **Sanity Presentation pattern**: the admin preview iframe shows the public site; clicking any rendered string / image / section in the preview jumps to the exact editor field for it.

This is the visible payoff of the MCP-driven authoring story:

- Agent generates a page via natural language
- Operator opens the page in the admin
- Operator clicks the headline that needs adjusting → editor pane jumps to the Hero module's heading field, focus + scroll into view
- Operator types the change → ⌘S → publish

Sidebar-on-click first (Sanity Storyblok pattern). Full inline typing is a follow-up if real demand emerges.

## Why now

- Our differentiation is "natural language → ready page." Without click-to-edit refinement, the operator has to mentally trace "the page in preview → which module → which field" to make any tweak. That mental trace is the gap that makes the MCP narrative feel half-baked.
- Sanity, Storyblok, Contentful Studio all ship this pattern. Operators evaluating us against them will look for it.
- The infrastructure cost is low: a data attribute on every rendered block + a postMessage listener in the admin shell + a single dispatcher that resolves schemaPath → editor route + field focus.

## Design

### Contract: `data-edit-target="<schemaPath>"`

Every rendered content block carries a `data-edit-target` attribute when rendered inside the admin preview iframe. The attribute encodes the schema path the editor pane needs to focus:

- `data-edit-target="page:{pageId}/section:{sectionId}/module:{moduleId}/field:heading"`
- `data-edit-target="post:{postId}/field:title"`
- `data-edit-target="product:{productId}/field:price"`

Path grammar: `<entity>:<id>` segments separated by `/`, ending with `field:<fieldName>` or `module:<id>` for the parent.

### Where the attribute comes from

Render-side: every module's display component accepts an optional `editorPath: string` prop. The page renderer passes it down when running inside the admin preview iframe (detected by `window.parent !== window` + a postMessage handshake on mount).

```tsx
// ui/client/modules/Hero/Hero.tsx
export function Hero({content, editorPath}: HeroProps) {
    return (
        <section
            data-edit-target={editorPath ? `${editorPath}/module:${content.id}` : undefined}
        >
            <h1 data-edit-target={editorPath ? `${editorPath}/module:${content.id}/field:heading` : undefined}>
                {content.heading}
            </h1>
            <p data-edit-target={editorPath ? `${editorPath}/module:${content.id}/field:body` : undefined}>
                {content.body}
            </p>
        </section>
    );
}
```

Edit-mode only — production HTML never carries `data-edit-target`. Gated by an env / postMessage probe so it's free for public visitors.

### Click handler in admin shell

`ui/admin/shell/PreviewIframe/clickInterceptor.ts`:

```ts
window.addEventListener('message', (evt) => {
    if (evt.data?.type === 'preview:click' && typeof evt.data.editTarget === 'string') {
        dispatchToEditor(parseEditTarget(evt.data.editTarget));
    }
});

function parseEditTarget(target: string): EditTargetDescriptor {
    // 'page:p1/section:s1/module:m1/field:heading'
    // → {entity: 'page', id: 'p1', sectionId: 's1', moduleId: 'm1', field: 'heading'}
    const parts = target.split('/').map((seg) => {
        const [kind, id] = seg.split(':');
        return {kind, id};
    });
    return composeDescriptor(parts);
}

function dispatchToEditor(d: EditTargetDescriptor) {
    // Route to the editor pane + open the right drawer + focus the field.
    router.push(`/admin/${entityRoute(d.entity)}/${d.id}?focus=${encodeURIComponent(d.field ?? '')}`);
}
```

Inside the iframe, a tiny script intercepts clicks on `[data-edit-target]` and posts back to the parent:

```ts
// ui/client/lib/inlinePreviewClickBridge.ts
if (window.parent !== window) {
    document.addEventListener('click', (evt) => {
        const target = (evt.target as HTMLElement)?.closest<HTMLElement>('[data-edit-target]');
        if (!target) return;
        evt.preventDefault();
        const editTarget = target.getAttribute('data-edit-target');
        window.parent.postMessage({type: 'preview:click', editTarget}, '*');
    }, true);
}
```

### Hover affordance

On hover (only in preview mode), show a 2 px outline + a small pill labelling the field. Outline color = `var(--ant-color-primary)`. Pill uses the existing admin theme tokens. Suppressed when inline-typing lands later.

### Mode detection

Inside the iframe:

```ts
const isPreview = window.parent !== window && new URLSearchParams(window.location.search).has('__preview');
```

The admin shell sets `?__preview=1` when loading the iframe + adds a security `targetOrigin` check on `postMessage`.

### Out of scope (file as follow-ups)

- **Full inline typing** (Gutenberg-style) — separate item; the data-edit-target plumbing is the prerequisite.
- **Drag-to-reorder in the preview** — Sanity ships this; we can layer on once click-to-edit is solid.
- **Visual annotation overlays** (comments, presence) — separate item.

## Files to touch

- `ui/client/lib/inlinePreviewClickBridge.ts` (new) — iframe-side click interceptor
- Every `ui/client/modules/<Name>/<Name>.tsx` — accept `editorPath`, pass `data-edit-target` to leaf fields
- `ui/client/lib/withPageEditorPath.ts` (new) — page-renderer helper that threads `editorPath` through section + module hierarchy
- `ui/admin/shell/PreviewIframe/PreviewIframe.tsx` — render iframe with `?__preview=1`, install postMessage listener
- `ui/admin/shell/PreviewIframe/clickInterceptor.ts` (new) — parent-side dispatcher
- `ui/admin/lib/editorRouter.ts` (new) — resolves `EditTargetDescriptor` → route + focus query param
- Per-feature: editor panes consume `?focus=<field>` query param to scroll + focus the right input on mount
- Tests: e2e spec that loads page → clicks heading in preview → asserts Page editor opened with the right module + focused field

## Starter code

The iframe-side script + parent-side click dispatcher are pasted above; treat as the spec.

For a module display component:

```tsx
// ui/client/modules/Manifesto/Manifesto.tsx
export function Manifesto({content, editorPath}: ManifestoProps) {
    const slot = (field: keyof ManifestoContent) =>
        editorPath ? `${editorPath}/module:${content.id}/field:${field}` : undefined;
    return (
        <section data-edit-target={editorPath ? `${editorPath}/module:${content.id}` : undefined}>
            <h2 data-edit-target={slot('heading')}>{content.heading}</h2>
            <p data-edit-target={slot('body')}>{content.body}</p>
        </section>
    );
}
```

For an editor pane consuming `?focus=heading`:

```tsx
// ui/admin/features/Pages/HeroEditor.tsx
const router = useRouter();
const focusField = router.query.focus as string | undefined;

useEffect(() => {
    if (focusField) {
        const input = formRef.current?.querySelector<HTMLInputElement>(`[data-field="${focusField}"]`);
        input?.scrollIntoView({behavior: 'smooth', block: 'center'});
        input?.focus();
    }
}, [focusField]);
```

## Acceptance

1. Hovering any rendered string / image / section in the admin preview shows the outline + field pill
2. Clicking dispatches to the correct editor pane with the right module + field focused (no full reload — SPA route)
3. Production-mode public site does NOT carry `data-edit-target` (verified by build smoke)
4. Works across all existing module types (Hero, Manifesto, Gallery, Carousel, RichText, PlainText, Timeline, Stats, Testimonials, ProjectGrid, Services, SocialLinks)
5. Works for page-level fields (slug, title, parent), post-level fields, product-level fields
6. `postMessage` enforces `targetOrigin` matching the admin domain (security gate)
7. Smoke e2e: open page in preview → click headline → assert Pages editor pane open + heading input focused + scrolled into view

## Effort

**L · ~4-6 hours AI.**

- Iframe bridge + parent dispatcher + mode detection: ~1 hour
- Page renderer `editorPath` threading: ~1 hour
- Per-module attribute pass: ~1 hour (mechanical across 12 modules)
- Editor-pane `?focus=…` handling: ~1 hour
- Hover affordance SCSS + accessibility (focus-visible parity): ~30 min
- E2e: ~1 hour

## Dependencies

- Existing preview iframe machinery (`ui/admin/shell/PreviewIframe/` — check shape; if not there, build it first as a smaller sub-task)
- No new project deps

## Open questions

None for the click-to-edit slice. Inline-typing is a separate item if/when demand emerges.

## Out of scope

- Full inline-typing rich-text-in-canvas (separate item)
- Visual presence indicators / comments / annotations (separate item)
- Inline drag-to-reorder in the preview (separate item)
