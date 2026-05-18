# Admin UI mode — simplified base, advanced composes

Status: shipped 2026-05-12 (Themes + Posts foundational refactor).
Spec: [`docs/roadmap/admin/aui-mode-hierarchy.md`](../roadmap/admin/aui-mode-hierarchy.md).

## TL;DR

Every admin pane that ships both AUI modes follows the same shape:

```
ui/admin/features/<Name>/
├── <Name>SimplifiedView.tsx   # base — owns the minimum viable surface
├── <Name>AdvancedView.tsx     # composes Simplified + adds power-user controls
├── <Name>ViewModel.ts         # shared VM (both variants render against it)
└── <Name>AdminUILoader.ts     # registers both with React.lazy
```

Rules (enforced by ESLint where mechanical, reviewer-checked otherwise):

1. **Simplified is the base.** Advanced imports Simplified, not the other way around. The ESLint rule under `ui/admin/features/**/*SimplifiedView.{ts,tsx}` blocks `**/*AdvancedView` imports.
2. **Both variants are `React.lazy`-loaded** in `<Name>AdminUILoader.ts`. The shell wraps the active pane in `<Suspense>`. A user in simplified mode never downloads the advanced chunk.
3. **Mode-prefixed testids for variant-distinct surfaces.** When a wrapper differs between modes — e.g. a card grid (`themes-simplified-card-{id}` vs `themes-advanced-card-{id}`) — emit a mode-prefixed `data-testid`. Surfaces that render identically in both modes (Activate button, Refresh, the New… button) keep their no-prefix testid on the simplified base and inherit when advanced composes.
4. **Same VM.** Both variants render against the same `<Name>ViewModel`. The advanced view typically constructs the VM and passes it down via a `vm` prop on the simplified base.
5. **Slots, not branches.** Simplified exposes opt-in slots (`headerExtra`, `renderRowExtras`, `renderDrawer`, `renderCardActions`) so advanced can inject extras without forking the body. If the advanced editor's form is shape-incompatible (different fields, validation, width) — a Drawer replacement via `renderDrawer` is cleaner than a per-field-prop gymnastic.

## Lazy-load convention

The pattern lives in each feature's `<Name>AdminUILoader.ts`:

```ts
const ThemeAdvanced = React.lazy(() => import('./ThemeAdvancedView'));
const ThemeSimplified = React.lazy(() => import('./ThemeSimplifiedView'));

export class ThemeAdminUILoader extends AdminUILoader {
    readonly adminPane: AdminPaneDescriptor = {
        modes: {
            advanced: ThemeAdvanced,
            simplified: ThemeSimplified,
        },
        // …
    };
}
```

`AdminPaneDescriptor.modes` accepts `ComponentType | LazyExoticComponent` (see `ui/admin/lib/loaders/AdminUILoader.ts`). The shell dispatcher wraps the active pane in `<Suspense>`, so eager `ComponentType` and lazy variants both work, but the convention going forward is **always lazy** for both modes so the bundle splits per feature × mode.

## ESLint enforcement

`eslint.config.mjs` ships an `error`-level block for `ui/admin/features/**/*SimplifiedView.{ts,tsx}` with `no-restricted-imports.patterns` banning `**/*AdvancedView` imports. Adding a new simplified pane that grabs from its own advanced sibling fails CI.

## Testids

Per `docs/architecture/test-ids.md`. The AUI-specific addition:

- `<feature>-simplified-{role}` — simplified-mode surfaces that differ from advanced.
- `<feature>-advanced-{role}` — advanced-only controls.
- `<feature>-{role}` (no prefix) — shared surfaces. Live on the simplified base; advanced inherits.

Themes + Posts emit `data-legacy-testid` for the pre-refactor card / row id (`themes-list-row-{id}`, `posts-row-{id}`) so anything still scanning by the old attribute keeps working during the migration window. Drop those once downstream e2e + MCP scripts are updated.

## Onboarding a new pane to the hierarchy

Each new pane is its own roadmap item (priority list in the AUI hierarchy spec). The shape is:

1. Author `<Name>SimplifiedView.tsx` — the smallest useful surface, with slots for advanced extras.
2. Author `<Name>AdvancedView.tsx` — `import {…} from './<Name>SimplifiedView'`, render it, pass `mode="advanced"`, and slot in the additional controls.
3. Register both with `React.lazy` in `<Name>AdminUILoader.ts`.
4. Add mode-prefixed testids where the variant identity differs.
5. (Optional) gate experimental advanced sub-features behind `siteFlags` entries — see the spec for the per-feature flag protocol.
