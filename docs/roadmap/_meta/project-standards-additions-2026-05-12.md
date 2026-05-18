# Project standards — additions from 2026-05-12 research

Additions to project-wide standards triggered by the [research-findings-2026-05-12.md](research-findings-2026-05-12.md) pass. Each standard ships with the roadmap item that introduces it; this doc is the catalogue + rationale.

Pair with the existing [target-architecture.md](target-architecture.md). When in conflict, the more-specific item wins.

## 1. Sonner is the only toast library

**Rule:** All user-facing async operations route through Sonner's `toast.promise` (or `toast()` with an Undo action for destructive ops). Custom toast components, AntD `message.*`, raw `alert()` are banned.

**Why:** Sonner is the industry default (OpenAI, Adobe, Sonos, shadcn/ui), pairs cleanly with React 19 `useOptimistic`, and gives Undo for free.

**Lint rule (to be added):** `no-restricted-imports` ban `from 'antd' import message`. Manual review for new project deps.

**Reference impl shipped with:** [admin-toast-system-sonner.md](../admin/admin-toast-system-sonner.md)

## 2. Command palette via kbar — every menu action gets an entry

**Rule:** Every admin action that lives in a menu / button / context menu also registers as a kbar action. The keyboard shortcuts catalogue lives in one file (`ui/admin/shell/CommandPalette/actions.ts`).

**Conventions:**
- `⌘K` open palette
- `⌘S` save active document
- `⌘↵` publish active document
- `?` open shortcut cheatsheet
- `/` inline-search inside active list

**Why:** Linear-grade shortcuts are now a baseline expectation. The cost of adding a kbar action per button is one extra hook call; the discoverability win is large.

**Reference impl shipped with:** [admin-command-palette.md](../admin/admin-command-palette.md)

## 3. dnd-kit only — no other DnD libraries

**Rule:** All drag-and-drop in the admin uses `@dnd-kit/core` + `@dnd-kit/sortable`. No `react-beautiful-dnd`, no custom HTML5 DnD wrappers. Existing usage must migrate when touched.

**Required configuration:**
- `KeyboardSensor` enabled with default arrow + space/enter + escape bindings (WCAG 2.1 AA)
- `TouchSensor` with `activationConstraint: {delay: 250, tolerance: 8}` (mobile long-press)
- Visible drag handle with `touch-action: none`
- Live-region announcements via `accessibility` prop

**Why:** dnd-kit is the only accessible DnD library in the React ecosystem currently maintained. We hit a documented bug in the current reorder system (see open queue's "Section drag-reorder root cause") that the migration also resolves.

## 4. Motion tokens — Carbon / Material 3 shape

**Rule:** All animation timing and easing reads from CSS custom properties on the motion-token scale. Hard-coded `200ms` / `cubic-bezier(...)` values are banned in new code.

**Required tokens** (defined in `ui/client/styles/_motion-tokens.scss`, exported as CSS vars on `:root`):

```css
:root {
    --motion-duration-fast: 150ms;        /* button states */
    --motion-duration-base: 250ms;        /* card / modal */
    --motion-duration-slow: 400ms;        /* page section */
    --motion-duration-deliberate: 700ms;  /* hero / page transition */

    --motion-ease-standard: cubic-bezier(.4, 0, .2, 1);
    --motion-ease-entrance: cubic-bezier(0, 0, .2, 1);
    --motion-ease-exit:     cubic-bezier(.4, 0, 1, 1);
    --motion-ease-emphasized: cubic-bezier(.2, 0, 0, 1);

    --motion-distance-sm: 8px;
    --motion-distance-md: 24px;
    --motion-distance-lg: 64px;

    --motion-stagger: 60ms;
    --motion-scalar: 1;
}

@media (prefers-reduced-motion: reduce) {
    :root {
        --motion-scalar: 0;
    }
}
```

Usage:
```css
.card-enter {
    transition: transform calc(var(--motion-duration-base) * var(--motion-scalar)) var(--motion-ease-entrance);
}
```

**Why:** Without a shared token scale, theme animations become per-component snowflakes. The scalar gates reduced-motion globally without per-component `if` checks.

**Reference impl shipped with:** [motion-token-system.md](../admin/motion-token-system.md)

## 5. Design-token hierarchy — 3 layers

**Rule:** All design tokens live in one of three layers. Cross-layer leaks (e.g. a component referencing `--blue-500` directly) flagged by Stylelint custom rule.

- **Primitive** — `--blue-500`, `--space-4`, `--font-serif`. Theme-independent. Defined once in `ui/client/styles/_primitives.scss`.
- **Semantic** — `--color-surface`, `--color-accent`, `--space-section`, `--font-display`. Per-theme override target. Defined in `ui/client/styles/_semantic.scss` with `[data-theme="<slug>"]` selectors.
- **Component** — `--btn-primary-bg`, `--card-padding`. Reads from semantic. Defined alongside the component's SCSS.

**Theme override = override the semantic layer only.** Primitives stay shared.

**Why:** Without the hierarchy, themes become find-and-replace exercises. With it, swapping a theme = updating one `[data-theme]` block.

**Reference impl shipped with:** [first-class-themes.md](../storefront/first-class-themes.md)

## 6. Mode = `light-dark()` CSS function (or `[data-mode]` fallback)

**Rule:** Every theme ships **both** light and dark mode definitions. Mode is independent of theme. Use `light-dark()` CSS function where supported; fall back to `[data-mode="dark"]` selector blocks where it's not.

```css
:root {
    color-scheme: light dark;
}

[data-theme="editorial"] {
    --color-surface: light-dark(#fdfdfd, #161616);
    --color-ink:     light-dark(#1a1a1a, #ededed);
}
```

**Why:** Mode is brightness; theme is identity. Coupling them creates 2N variants instead of N + 1. Sourced from Tailwind v4 / Open Props patterns.

## 7. AntD `cssVar: true` — enabled

**Rule:** AntD `ConfigProvider` runs with `cssVar: true`. SCSS that wants AntD-aware styling reads from `var(--ant-color-*)` rather than hardcoding palette values.

**Why:** Without this, the admin has two parallel color systems (AntD ConfigProvider tokens and `[data-admin-theme="dark"]` SCSS) that drift. Enabling cssVar collapses them into one.

**Reference impl shipped with:** [admin-dark-mode-audit.md](../admin/admin-dark-mode-audit.md)

## 8. WCAG 2.2 AA minimum on every new theme + new public surface

**Rule:** New themes and new customer-facing surfaces (signup, checkout, account, ss.com cars) pass WCAG 2.2 AA before merge. Per-checklist:

- 4.5:1 text contrast in **both** modes (APCA preview run)
- Visible 2 px focus ring on accent surfaces
- All motion gated on `prefers-reduced-motion` (via the `--motion-scalar` token)
- **44 × 44 px minimum touch targets**
- No information conveyed by color alone (add icon / label)

**Why:** EU EAA legally requires WCAG 2.2 AA from 2025; US ADA Title II deadline April 2026. Easier to bake in than retrofit.

**Tooling:** axe-core in e2e visual baselines; `--workers=1` lighthouse pass once visual baselines exist (Q4-cap dependency).

**Reference impl shipped with:** [accessibility-wcag22-audit.md](../storefront/accessibility-wcag22-audit.md)

## 9. Touch target minimum — 44 × 44 px on all interactive surfaces

**Rule:** Every clickable / tappable element renders at minimum 44 × 44 px on touch viewports. Smaller visual elements get a wrapping hit area.

**Why:** Apple HIG + WCAG 2.5.5 standard; lifts mobile usability for everyone.

**Lint rule (to be added):** Stylelint custom plugin warns when a `button` / `a` / `input[type=button]` has computed dimensions below 44 px in a `@media (pointer: coarse)` block.

## 10. Container queries for module-level responsiveness

**Rule:** Module SCSS prefers `@container` queries over `@media` queries when the module's layout depends on its own size, not the viewport's.

```css
.gallery {
    container-type: inline-size;
}
.gallery-tile {
    width: 100%;
}
@container (min-width: 480px) {
    .gallery-tile { width: 50%; }
}
@container (min-width: 720px) {
    .gallery-tile { width: 33.33%; }
}
```

**Why:** A gallery rendered inside a 50/50 section row at 1440 px should look like its mobile layout, not its desktop layout. Media queries can't see the parent size; container queries can.

**Reference impl shipped with:** Per-module pass in [first-class-themes.md](../storefront/first-class-themes.md)

## 11. Receipt emails through a shared `EmailService.sendReceipt(orderId)` API

**Rule:** All transactional / receipt / magic-link emails go through `EmailService` with templates registered as TypeScript modules under `services/features/Email/templates/`. No inline HTML strings in services.

**Why:** Templates need design discipline (visual progress timeline, dated next-step milestones, mobile-first markup). Embedding HTML in services makes them un-reviewable.

**Reference impl shipped with:** [storefront-receipt-emails.md](../storefront/storefront-receipt-emails.md)

## 12. `data-edit-target` on rendered content blocks

**Rule:** Every rendered content block (module / section / inline field) on the public site carries `data-edit-target="<schemaPath>"` when rendered inside the admin preview iframe.

**Why:** Enables Sanity-Presentation-style click-to-edit. The admin preview iframe listens for clicks on `[data-edit-target]` and dispatches to the matching editor pane.

**Reference impl shipped with:** [admin-inline-editing.md](../admin/admin-inline-editing.md)

## 13. Delivery philosophy — jumps, not iterations

**Rule:** Ship as **complete jumps**, not careful iterations. Take big chunks. Accept temporary breakage during a chunk. Rely on the test + e2e harness as the verification gate, not manual review at every micro-step.

**What this looks like in practice:**

- A "chunk" is one complete deliverable end-to-end — schema + service + admin pane + client pane + MCP tools + tests + docs — landing in one PR. Not "Phase 1 / Phase 2 / Phase 3."
- During implementation, the working tree may be red. **That's fine** — the gate is "tests + e2e green at PR-open time," not "every intermediate commit green."
- Combine related items into single chunks where the coupling makes review easier (e.g. `Releases` entity + admin pane + MCP tools + every per-feature "Add to release" hook = one chunk, not five).
- **No partial-feature deploys.** A feature is either complete (acceptance criteria met) or not merged.
- Spend the AI agent budget on covering acceptance criteria with tests rather than on incremental human-review cycles. Tests are the contract.

**What this is NOT:**

- It is NOT "skip tests to ship faster." Tests are MORE important under jumps, not less — they're the only verification.
- It is NOT "merge broken code to main." Each merge is green; only the WIP working tree can be red.
- It is NOT "skip operator review." Operator reviews the whole jump at PR-open time. The savings come from skipping review-of-incremental-WIP.

**Why:**

- AI agent work compresses ~10-30× on mechanical work, ~3-5× on decision-heavy work (per the [effort legend calibration](../README.md#effort-legend--ai-paced)). The bottleneck shifts to review cycles, not throughput.
- Small iterations multiply review-cycle overhead. Five 1-hour chunks = five context-restorations + five PR-review passes. One 5-hour chunk = one of each.
- Storefront program scope is large; iteration overhead would add weeks of pure ceremony.

**When NOT to do jumps:**

- Architectural decisions with high uncertainty (database engine switch, framework upgrade) — keep iterative with `mark_chapter` boundaries
- Multi-system migrations where staged rollout protects against blast radius (the [`terraform-kamal-migration.md`](../platform/terraform-kamal-migration.md) shipped staged for a reason)
- Anything operator-facing that needs ship-decision midway (e.g. "should we change the theme list shape after seeing the first one render?")

**How to size a jump:**

- Default: aim for one roadmap item = one jump = one PR
- If an item is XL, break it into named sub-items in the roadmap README; each sub-item is then a jump
- If a jump would touch >50 files, split — that's a sign of poor coupling, not careful jumps
- Estimate the jump in **AI agent hours**, not days. See §14 below.

**Test + e2e harness as the gate:**

- Unit tests (Vitest) — fast, every service mutation covered, every loader manifest validated
- E2e tests (Playwright) — every happy-path of every public surface, every destructive admin flow with rollback, visual baselines once Q4-cap lands
- Accessibility tests (axe-core in Playwright) — every public surface × every theme × both modes
- MCP schema-drift CI — every GraphQL mutation has a matching MCP tool
- Lint (ESLint flat config) — VM4 rule + import-direction rules + Sonner-only-toasts + motion-token-no-hardcoded-ms

All five must pass at PR-merge time. If they pass, the jump shipped correctly.

## 14. Estimates — AI agent units, not man-days

**Rule:** Every roadmap item estimate is in **AI agent work**, sized against the [effort legend](../README.md#effort-legend--ai-paced). Man-days, person-days, "human equivalent" — banned in new items.

| Size | AI budget | Approximate AI hours |
|---|---|---|
| XS | < 15 min | 0.25 h |
| S | 15-60 min | 0.5-1 h |
| M | 1-3 h | 1-3 h |
| L | 3-8 h | 3-8 h |
| XL | 1-3 days AI (≈ 8-24 h) | 8-24 h |

**Wall-clock time** (deploys, real-device QA, operator-decision pauses) is tracked separately when relevant. Don't fold it into the AI estimate.

**Calibration evidence** continues to live in the effort legend table in README.md; update it as items ship.

**Why this matters under the jumps philosophy:**

- Jumps are sized by AI throughput; padding for human ceremony defeats the philosophy
- Mixed units (some items in man-days, others in AI hours) make wave totals incomparable
- Operator decisions take calendar time; they don't take AI budget — keep them visible separately

When in doubt, **estimate the AI work as if a single agent picks up the chunk and ships it in one pass against a green test harness**. That's the contract.

## Adoption strategy

These standards land **with the roadmap items that introduce them**, not as a separate sweep. The first time an item touches relevant code, it brings the standard with it. Older code migrates opportunistically (touched files only).

Lint enforcement gates close as critical mass crosses ~80% of relevant files — until then, the standards are review-checked, not CI-checked, to avoid blocking unrelated work.

## Cross-referencing the existing 4 universal requirements

The existing universal requirements ([README.md](../README.md#universal-requirements--every-roadmap-item)) stay in force:

1. Docs reflect the work
2. MCP coverage parity for editable surfaces
3. Ship as chunks, not phases
4. `data-testid` on every interactive surface

The 12 standards above **add** to these; they don't replace them.
