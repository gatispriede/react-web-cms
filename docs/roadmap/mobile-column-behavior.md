# Mobile column behavior — collapsible rows

## Goal

Today every multi-column section on the public site collapses 50/50 → 100/100 stacked on mobile in DOM order. That works for short rows but for long-form content (timeline + facts list, hero + portrait + meta dl, paper-grid lists, INFRA_TOPOLOGY + caption) it produces a 3000px tall page with no way to triage.

Replace flat-stack with **collapsible rows**: on narrow viewports, multi-column section rows render as drawer-style accordions with chevron-rotate expand/collapse, matching the existing public-side `MobileNav` pattern. The section is the slot; collapse behaviour is configured at the section level via a single enum field.

## Why now

- Real client feedback (2026-05-04) flagged the stack-everything default as unusable on tall section-rich pages.
- The existing `MobileNav` drawer + `.mobile-nav-toggle` chevron rotate (shipped 2026-05-03) is the design language we already lean on. Reusing it gives the public site mobile UX one consistent gesture.
- F6 site-mode-toggle (active Wave 2) doesn't change this layer; mobile column work is orthogonal.

## Design

### Field shape — section-level (decided 2026-05-07)

One field on the section, not per-module:

```ts
// shared/types/ISection.ts
interface ISection {
  // ...existing
  layout?: {
    mobileBehavior?: 'stack' | 'collapse' | 'keep-ratio';
    // future: ...other responsive flags
  };
}
```

| Value | Behavior below 768 px |
|-------|----------------------|
| `'stack'` (default) | Existing flat collapse — columns stack to 100% width in DOM order |
| `'collapse'` | Drawer-style accordion — first column visible, subsequent columns collapsed under a chevron-rotate toggle |
| `'keep-ratio'` | Preserve column widths via horizontal scroll — for tables / wide diagrams that don't decompose |

Default stays `'stack'` so existing sites are unaffected. Authors opt into `'collapse'` for long content, `'keep-ratio'` for fixed-width visualisations.

### Why section-level not module-level

Per architecture: "section is the slot, module is the contents." The collapse behaviour applies to the **row**, not to any individual module inside it. Putting `mobileBehavior` on each module would force every multi-column module to carry the same field — DRY violation. Section-level: set once per row, applies uniformly.

If a single module ever genuinely needs override (e.g. a Gallery that should always horizontal-scroll regardless of section setting), add a per-module override later. YAGNI for now.

### UI pattern — drawer-style accordion

Reuse the existing `MobileNav` SCSS approach:
- First column always visible.
- Subsequent columns collapsed inside a `.section-row__drawer` block.
- A `.section-row__toggle` chevron button with the same 38px hit target + 180deg rotate transition as `.mobile-nav-toggle`.
- Optional first-render expanded state per section (`layout.defaultOpenOnMobile?: boolean`); persisted choice via `sessionStorage` per section id (so toggling state survives navigation within the session).

Reference: existing public-side `MobileNav.scss` lines that ship the chevron rotate (search for `.mobile-nav-toggle > span`). Same animation curve, same hit target. Visual reference comes from the impeccable design plugin's collapsible-content patterns — pull a reference frame from the plugin when starting Phase 1.

### SCSS shape — shared mixin

```scss
// ui/client/styles/Common/_responsive.scss (new)
@mixin section-row-collapsible($breakpoint: 768px) {
  @media (max-width: #{$breakpoint - 1px}) {
    --section-row-direction: column;
    .section-row__column:not(:first-child) {
      display: none;
      &.is-expanded { display: block; }
    }
    .section-row__toggle { display: inline-flex; }
  }
}
```

The mixin is **reused by Mobile-friendly admin Phase 2** for the admin editor rows — both surfaces collapse the same way. One source of truth for the breakpoint + the chevron behaviour.

### Renderer integration

`ui/client/lib/SectionRenderer.tsx` (or wherever the multi-column row layout currently lives — probably the type-3 section render path, given today's `slots: [N, N]`) checks `section.layout?.mobileBehavior`:
- `'stack'` (default): no class, existing CSS handles flat collapse
- `'collapse'`: add `.section-row--collapsible` class, render the `.section-row__toggle` button
- `'keep-ratio'`: add `.section-row--keep-ratio` class, suppresses the breakpoint stack rule

JS only on `'collapse'` (toggle state); other variants are pure CSS.

### Admin authoring

`ui/admin/features/Navigation/SectionLayoutEditor.tsx` (or the existing section-level config slot — probably already exists for slot weights) exposes the `mobileBehavior` Select with the three options + descriptions. Predefined-selection rule: enum, no free text.

## Files to touch

- `shared/types/ISection.ts` — extend with `layout.mobileBehavior` enum.
- `ui/client/lib/SectionRenderer.tsx` (or equivalent type-3 row renderer) — branch on `mobileBehavior`.
- `ui/client/styles/Common/_responsive.scss` — new mixin.
- `ui/client/styles/SectionRow.scss` (or equivalent) — apply mixin per behavior class.
- `ui/admin/features/Navigation/SectionEditor.tsx` (or wherever section-level config sits today) — add the Select.
- `services/features/Navigation/NavigationService.ts` — pass-through; no validation beyond enum membership.
- `services/features/Navigation/feature.manifest.test.ts` — extend if it asserts ISection shape.
- Tests: e2e visual baseline at 375px width (iPhone SE) with each behavior set.

### Testids — for e2e

Per the universal `data-testid` rule. Reused by the Mobile-friendly admin Phase 2 spec since the same SCSS mixin powers both surfaces.

- `section-row-{sectionId}` — every multi-column section row (parent)
- `section-row-toggle-{sectionId}` — chevron-rotate toggle button (only rendered when `mobileBehavior === 'collapse'`); assert `[data-state="open"|"closed"]`
- `section-row-column-{sectionId}-{n}` — each column slot
- `section-row-{sectionId}-behavior-{stack|collapse|keep-ratio}` — variant indicator (or use `[data-mobile-behavior]` attribute)

Admin authoring side:
- `section-layout-editor-{sectionId}-mobile-behavior-select` — the AntD Select that exposes the enum
- `section-layout-editor-{sectionId}-mobile-behavior-option-{stack|collapse|keep-ratio}` — each option

E2e coverage:
- `tests/e2e/visual/section-mobile-collapse.spec.ts` — visual baseline at 375px width per behavior variant (Q4-cap dependency).
- `tests/e2e/admin/section-mobile-behavior.spec.ts` — admin sets a section to `'collapse'` → public-side mobile preview shows accordion → toggle expands the second column → reload preserves the persisted toggle state via sessionStorage.

### MCP coverage

`section.update` already accepts the section payload generically. Extend its `inputSchema` to whitelist `layout.mobileBehavior` so MCP-driven authoring can set it:

```ts
// services/features/Mcp/tools/sections.ts — section.update inputSchema.properties.section
layout: {
    type: 'object',
    properties: {
        mobileBehavior: {
            type: 'string',
            enum: ['stack', 'collapse', 'keep-ratio'],
            description: 'Mobile column layout. "stack" (default) flattens columns to 100% width. "collapse" renders subsequent columns under a chevron-rotate accordion. "keep-ratio" preserves widths via horizontal scroll.',
        },
    },
}
```

No new tool — section.update is the write path. Update the tool description to mention layout authoring so agents discover it.

Docs follow-up: add a "Mobile column behavior" entry to `docs/architecture/section-shape.md` (or wherever `ISection` is documented) so the next dev reading the type knows when to set the field.

## Acceptance

1. Existing sites render identically — `mobileBehavior` undefined → `'stack'` → existing flat collapse.
2. Author switches a long row to `'collapse'` → mobile preview shows first column, chevron toggles the rest.
3. `'keep-ratio'` preserves column widths with horizontal scroll on a wide table/diagram.
4. Toggle state persists across in-session navigation (sessionStorage key includes section id).
5. Visual baselines captured for each variant under `tests/e2e/visual/` (Q4-cap dependency — wait until baselines exist).
6. The shared `@mixin section-row-collapsible` is consumed by Mobile-friendly admin Phase 2 for editor rows.

## Effort

**S · 1 day.**

- Types + service pass-through: 1 h
- SCSS mixin + breakpoint rules: 2 h
- Renderer branch + chevron toggle component: 2 h
- Admin Select: 1 h
- Tests + visual snapshots (after Q4-cap): 2 h

## Dependency notes

- **Q4-cap (Wave 3 #11) ideally before this** — visual baselines protect the rollout.
- **Mobile-friendly admin Phase 2 reuses the SCSS mixin** — schedule this either before or in parallel with admin Phase 2; the mixin lands on the public side first.
- F6 site-mode-toggle is independent.

## Open questions (already decided 2026-05-07)

1. ~~Section-level vs module-level field?~~ → **Section-level.** One field on `ISection.layout.mobileBehavior`.
2. ~~Stack default or collapse default?~~ → **Stack default** for back-compat.
3. ~~Persist toggle state?~~ → **sessionStorage per section id** — survives in-session nav, doesn't pollute long-term.