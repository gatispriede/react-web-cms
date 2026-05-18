---
name: motion-token-system
description: Project standard for animation timing + easing + distance. CSS custom properties on the Carbon / Material 3 motion-token shape, with a `--motion-scalar` that drops to 0 under `prefers-reduced-motion`. Ban hardcoded ms / cubic-bezier values in new code.
research: see research-findings-2026-05-12.md §4 Animation patterns 2025-2026
---

# Motion token system

## Goal

Centralise animation timing + easing + distance into CSS custom properties on a known scale. Every animation reads from the tokens — no hardcoded `200ms` or inline `cubic-bezier(...)`. `prefers-reduced-motion` flips a single `--motion-scalar` to 0, globally killing non-essential motion.

Reference: Carbon Design System + Material 3 motion tokens; sourced from [research findings](../_meta/research-findings-2026-05-12.md#animation-patterns-2025-2026).

## Why now

- [first-class-themes](../storefront/first-class-themes.md) needs animations as a first-class theme axis. Without tokens, each theme reinvents timing scales and `prefers-reduced-motion` plumbing.
- Existing animations across the codebase use ad-hoc ms values (`200ms`, `300ms`, `400ms`) — already drifting.
- This is a project-wide standard that lands as one chunk before any theme animation work begins; downstream items consume it.

## Design

### Tokens

Defined once in `ui/client/styles/_motion-tokens.scss`, imported into both client + admin global SCSS:

```scss
:root {
    /* Duration scale — Carbon / Material 3 ratio */
    --motion-duration-fast: 150ms;        /* hover / focus / press / small UI feedback */
    --motion-duration-base: 250ms;        /* card lift, modal open, dropdown */
    --motion-duration-slow: 400ms;        /* page section enter, accordion expand */
    --motion-duration-deliberate: 700ms;  /* hero reveal, route transition, theme switch */

    /* Easing curves */
    --motion-ease-standard:    cubic-bezier(0.4, 0, 0.2, 1);
    --motion-ease-entrance:    cubic-bezier(0,   0, 0.2, 1);  /* deceleration in */
    --motion-ease-exit:        cubic-bezier(0.4, 0, 1,   1);  /* acceleration out */
    --motion-ease-emphasized:  cubic-bezier(0.2, 0, 0,   1);  /* large, attention-pulling */

    /* Distance scale — translateY/translateX defaults */
    --motion-distance-sm:  8px;
    --motion-distance-md: 24px;
    --motion-distance-lg: 64px;

    /* Stagger unit for list-item entrance */
    --motion-stagger: 60ms;

    /* Reduced-motion master switch — multiplied into every duration */
    --motion-scalar: 1;
}

@media (prefers-reduced-motion: reduce) {
    :root {
        --motion-scalar: 0;
    }
}
```

### Usage patterns

```scss
/* Standard transition — multiply duration by the scalar so reduced-motion zeroes it */
.card-hover {
    transition: transform calc(var(--motion-duration-base) * var(--motion-scalar)) var(--motion-ease-standard);
}

.card-hover:hover {
    transform: translateY(calc(var(--motion-distance-sm) * -1));
}

/* Entrance with stagger */
.list-item {
    animation: enter calc(var(--motion-duration-slow) * var(--motion-scalar)) var(--motion-ease-entrance) backwards;
}
.list-item:nth-child(1) { animation-delay: calc(var(--motion-stagger) * 0); }
.list-item:nth-child(2) { animation-delay: calc(var(--motion-stagger) * 1); }
.list-item:nth-child(3) { animation-delay: calc(var(--motion-stagger) * 2); }

@keyframes enter {
    from { opacity: 0; transform: translateY(var(--motion-distance-md)); }
    to   { opacity: 1; transform: translateY(0); }
}
```

### Per-theme override (optional)

Themes that want a snappier or more languid feel override the duration scale only:

```scss
[data-theme="editorial"] {
    --motion-duration-base: 400ms;        /* slower, more contemplative */
    --motion-duration-slow: 700ms;
    --motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);  /* gentler */
}

[data-theme="agency"] {
    --motion-duration-base: 200ms;        /* snappier */
    --motion-ease-standard: cubic-bezier(0.4, 0, 0.05, 1);  /* punchier */
}
```

Primitives (eases) don't change per theme — only durations + which ease each theme prefers.

### `motion.ts` for JS-driven animations

When SCSS keyframes can't reach (scroll-tied animations, choreographed sequences), per-theme `motion.ts` reads from the same tokens:

```ts
// ui/client/lib/motion.ts
const root = getComputedStyle(document.documentElement);

export const motion = {
    duration: {
        fast: () => parseInt(root.getPropertyValue('--motion-duration-fast')) * Number(root.getPropertyValue('--motion-scalar')),
        base: () => parseInt(root.getPropertyValue('--motion-duration-base')) * Number(root.getPropertyValue('--motion-scalar')),
        // …
    },
    ease: {
        standard: () => root.getPropertyValue('--motion-ease-standard').trim(),
        // …
    },
    isReduced: () => Number(root.getPropertyValue('--motion-scalar')) === 0,
};
```

Motion One / Framer Motion call sites pull from this helper rather than hardcoding ms values.

### Lint enforcement

Stylelint custom rule (or `stylelint-no-restricted-syntax`) flags:

- `transition-duration: <ms>` with a numeric value (must use `var(--motion-duration-*)`)
- `animation-duration: <ms>` (same)
- Inline `cubic-bezier(...)` (must use `var(--motion-ease-*)`)

Migration window: warn-only for ~2 weeks while existing code migrates opportunistically (touched files only). Then escalate to error.

## Files to touch

- `ui/client/styles/_motion-tokens.scss` (new) — token definitions
- `ui/client/styles/main.scss` (or equivalent global import) — `@use './motion-tokens'`
- `ui/admin/styles/main.scss` — same import (admin uses the same tokens for editor animations)
- `ui/client/lib/motion.ts` (new) — JS-side helper
- `.stylelintrc.{js,cjs}` — custom rule for `transition-duration` / `animation-duration` / `cubic-bezier` restrictions
- Per-file migrations: opportunistic on touched files; no big-bang sweep needed
- Tests: visual baselines per duration token (Q4-cap dependency) confirm the tokens render at the right speed

## Starter code

The full tokens file above is the spec. Drop it in `ui/client/styles/_motion-tokens.scss`.

Migration example:

```scss
/* before */
.button {
    transition: background 200ms ease;
}

/* after */
.button {
    transition: background calc(var(--motion-duration-fast) * var(--motion-scalar)) var(--motion-ease-standard);
}
```

## Acceptance

1. `_motion-tokens.scss` defined + imported into client + admin
2. `prefers-reduced-motion: reduce` user setting kills every animation (verified by axe-core run + manual)
3. `motion.ts` helper exports duration / ease accessors that read from CSS vars
4. Stylelint rule warns on hardcoded `<ms>` durations + inline `cubic-bezier(...)` (warn-only initially)
5. Per-theme override demonstrated by [first-class-themes](../storefront/first-class-themes.md) (editorial = slow + gentle, agency = snappy + punchy)
6. Sample migration of ~5 existing animations in the codebase to prove the migration path
7. No regression on existing animations (visual baseline comparison Q4-cap dependent)

## Effort

**S · ~1 hour AI.**

- Tokens file + imports: ~10 min
- `motion.ts` helper: ~10 min
- Stylelint rule (warn-only): ~15 min
- Sample migration of 5 call sites: ~15 min
- Document + commit: ~10 min

## Dependencies

- None (foundational; downstream items consume it)

## Open questions

None.

## Out of scope

- Migrating every existing animation in one chunk (opportunistic per touched-file is fine)
- Per-component motion-token overrides (YAGNI until a theme requests it)
