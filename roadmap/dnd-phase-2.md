# DnD phase 2 — Library swap **Shipped** · intra-section items + image rail deferred

**Library swap (this PR):** Section-level [`DraggableWrapper`](../src/frontend/components/common/DraggableWrapper.tsx) rewritten over `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`. Three sensors:

- **PointerSensor** with 8 px activation distance (prevents accidental drags on click-through buttons inside sections)
- **TouchSensor** with 250 ms hold + 5 px tolerance (iPad scrolling stays usable)
- **KeyboardSensor** with `sortableKeyboardCoordinates` (`space` to grab, arrows to move, `space` to drop)

Auto-scroll near viewport edges is enabled by `<DndContext>` defaults — no extra wiring.

The pulsing `.section-drop-indicator` accent bar from the native-HTML5 incarnation is preserved: rendered at the gap above the hovered section (suppressed when over the source slot itself), composed on top of `verticalListSortingStrategy`'s implicit shift so editors get both cues. Inline `touch-action: none` on each draggable item so the user-agent passes the touch event to dnd-kit instead of starting a competing native scroll. SCSS untouched — the existing `.dnd-list` / `.dnd-item.is-dragging` classes still apply.

`onPosChange(from, to)` callback contract is unchanged so [`DynamicTabsContent.getChangedPos`](../src/frontend/components/DynamicTabsContent.tsx) needed no callsite updates.

**Verified at code level:** type-check clean, 110 tests pass, dev server compiles without error. **Manual verification needed:** touch-drag on a real iPad, auto-scroll on a long page.

**Intra-section item drag — pilot landed.** [`SortableList`](../src/frontend/components/common/SortableList.tsx) provides a small `<DndContext>` + `<SortableContext>` wrapper with explicit `≡` drag handles (so child `<Input>`s stay clickable — the listeners attach to the handle, not the row). Wired into [`InputList`](../src/frontend/components/Admin/ConfigComponents/InputList.tsx) as the proof-of-pattern.

Same recipe applies to the other array-backed configs ([`InputServices`](../src/frontend/components/Admin/ConfigComponents/InputServices.tsx), [`InputTimeline`](../src/frontend/components/Admin/ConfigComponents/InputTimeline.tsx), [`InputManifesto`](../src/frontend/components/Admin/ConfigComponents/InputManifesto.tsx), [`InputProjectGrid`](../src/frontend/components/Admin/ConfigComponents/InputProjectGrid.tsx), [`InputStatsCard`](../src/frontend/components/Admin/ConfigComponents/InputStatsCard.tsx), [`InputTestimonials`](../src/frontend/components/Admin/ConfigComponents/InputTestimonials.tsx), [`InputSocialLinks`](../src/frontend/components/Admin/ConfigComponents/InputSocialLinks.tsx)) — wrap the items map in `<SortableList ids={…} onReorder={…}>`, swap each row's outer wrapper for `<SortableHandleItem>`. ~10 min per file, no schema changes.

**Still deferred:**

- Rolling the `<SortableList>` pattern out to the remaining array-backed configs above (mechanical).
- Dockable right-hand image rail with `useDraggable` thumbnails dropping into gallery / plain-image modules — payload reuses the `setContent` channel the existing image-picker modal already uses. Independently substantial (rail UI + drop targets on every image-bearing module).

## Goal

Section-level DnD is already solid (native HTML5 rewrite of `DraggableWrapper` with drop-placeholders and gaps). Phase 2 takes DnD to the next level:

1. Viewport-edge auto-scroll — drag near the top/bottom of the list, page scrolls automatically
2. Touch support — iPad editors work
3. Items within a section become draggable (gallery items, list items, carousel slides)
4. Side panel with image library → drag an image directly into a gallery / image section

## Design

- Migrate from native HTML5 API to `@dnd-kit/core` + `@dnd-kit/sortable`. Rewrite `DraggableWrapper` to be a thin wrapper over `useSortable`.
- Auto-scroll + touch come free with `@dnd-kit`.
- Intra-section items: each array-backed item type (gallery, carousel, list) gets an ordered id strategy; id = `${sectionId}:item:${index}` or a stable guid if items carry one. Add `onDragEnd` that updates the section's content array and fires `refreshBus.emit('content')`.
- Image side panel: reuse the `ImageUpload` modal's grid in a dockable right-hand rail. Each tile is `useDraggable`. Drop target is the gallery / plain-image module. Drop handler calls `setContent` with the image metadata — same path as clicking a tile today.

## Files to touch

- `src/frontend/components/common/DraggableWrapper.tsx` — rewrite over `@dnd-kit`
- `src/frontend/components/Admin/ConfigComponents/InputGallery.tsx`, `InputCarousel.tsx`, list-like configs — wrap items in `useSortable`
- `src/frontend/components/Admin/AdminApp.tsx` — host the optional image rail
- `src/frontend/components/Admin/ImageRail.tsx` (new) — dockable, collapsible
- `src/frontend/components/Admin/ConfigComponents/InputPlainImage.tsx`, `InputGallery.tsx` — drop targets
- `package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`
- `package.json` — after this lands, `react-drag-reorder` dead; cross-link [debt-drop-react-drag-reorder.md](debt-drop-react-drag-reorder.md)

## Acceptance

- Drag a section near the top of the viewport → page auto-scrolls
- Touch-drag on iPad reorders sections correctly
- Reorder items inside a gallery → order persists, no ghost placeholder left behind
- Open image rail → drag a thumbnail onto a gallery → image appears as a new item
- Keyboard drag (`space` + arrows) still works (dnd-kit default)

## Risks / notes

- Existing `DraggableWrapper` has bespoke behaviour (drop-placeholder gap) — match it before removing the old code; don't ship a regression
- Intra-section drag is easy to over-scope. Keep phase 2 limited to array-of-items types. Tabular items (table rows) wait.
- Image rail state management: if the rail lives at AdminApp level but drop targets live deep in section config, drop payload goes through the same `setContent` channel the modal already uses. Don't invent a second path.

## Effort

**L · 1.5–2.5 engineering days**

- DraggableWrapper rewrite + parity with current placeholder behaviour: 4–6 h
- Intra-section items for gallery + carousel + list: 3–5 h
- Image rail component + drag source: 3–4 h
- Drop targets on image / gallery modules: 2–3 h
- Full regression pass across all section types: 2 h
