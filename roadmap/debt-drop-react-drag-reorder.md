# Debt — drop `react-drag-reorder` — **Shipped**

Dependency removed from `package.json` + lockfiles; historical comment in [`DraggableWrapper.tsx`](../src/frontend/components/common/DraggableWrapper.tsx) cleaned up.

## Goal

Native HTML5 DnD rewrite replaced `react-drag-reorder`. The dep is dead. Remove it from `package.json` + `package-lock.json` + `yarn.lock`.

## Steps

1. `grep -rn 'react-drag-reorder' src/` → confirm zero matches
2. `npm uninstall react-drag-reorder`
3. Commit the `package.json` + `package-lock.json` diff (and `yarn.lock` if used)

## Acceptance

- `grep -rn 'react-drag-reorder'` returns zero matches across the repo
- `npm install` clean on a fresh clone
- No runtime regression in the DnD surface

## Notes

- Do this *after* [dnd-phase-2.md](dnd-phase-2.md) if that work is imminent — otherwise do it now; the dep is already unused.

## Effort

**XS · 15–30 min**
