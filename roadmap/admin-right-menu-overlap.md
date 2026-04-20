# Admin right-side menu overlaps editor content

**Status:** Queued.

## Goal

The admin right rail (module/actions menu) no longer overlays the editing surface. Every edit target remains reachable at every viewport the admin supports (≥ 1280 px down to ~1024 px).

## Design

- Reserve layout space for the rail instead of overlaying — switch the admin shell to a CSS grid (`[nav] [canvas] [rail]`) where the rail column is part of the layout, not `position: fixed`.
- On narrower viewports (< 1280 px), rail collapses to a drawer toggled from a handle; canvas gets its full width.
- Audit any remaining `z-index` / `position: absolute` on rail children — none should float above canvas content.
- Scroll decoupling: rail has its own scroll container; canvas scroll is independent.

## Files to touch

- `src/frontend/components/AdminApp.tsx` (or the admin shell component that owns layout)
- Rail component (search `AdminRail` / `SideMenu` / similar)
- Admin shell SCSS — grid rules + drawer breakpoint

## Acceptance

- Every editable field across all section types is clickable without dismissing/moving the rail
- Shrinking viewport to ~1024 px collapses rail to drawer; expanding restores the column
- No regressions to existing hover/click behaviour elsewhere in admin
- Rail and canvas scroll independently

## Effort

**M · 3–5 h**
