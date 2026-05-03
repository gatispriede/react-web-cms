# F4 — SCSS scoping audit + sweep

## Goal

Each per-component SCSS file styles **only its own component**. No reaching into sibling/child component styles, no globally-scoped selectors that match outside the file's owner. The architecture invariant: opening `Hero.scss` should never affect `Footer`, and vice versa.

Out of scope for v1: CSS-in-JS migration, full CSS Modules conversion. The audit is structural — *what's allowed in each file*, not *how SCSS is bundled*.

## Why now

- The codebase has accumulated cross-bleed: per-module SCSS files declare bare-element rules (`p { … }`, `.image { … }`) that match outside the module. Editing one module's SCSS occasionally breaks another module's appearance — confirmed instability surface.
- AntD chrome rules sometimes live in component SCSS instead of `AdminDarkMode.scss` / a dedicated chrome partial, causing cross-component drift.
- F1 sub-pages added `NavMenu.scss` with `[data-theme-name]` overrides — that's correct; this audit confirms the pattern is followed elsewhere too.

## Design

### The rule

Per-component SCSS files (`<Module>/<Module>.scss`, `<Feature>/<Feature>.scss`) must be **scoped under a top-level class that matches the component's root**. Example:

```scss
// Hero.scss — every selector lives under .hero
.hero {
    // ...
    &__headline { … }
    &__cta { … }
    .image { … }   // OK — this matches `.image` inside .hero only
}

// Hero.scss — NEVER do this:
p { … }            // BAD — matches every <p> in the app
.image { … }       // BAD — escapes the .hero scope
```

### Allowed exceptions

- `ui/client/styles/globals/*.scss` — explicit globals; rules here are intentionally cross-cutting (resets, typography defaults, theme tokens, root variables).
- `ui/client/styles/Common/*.scss` — shared chrome (Header, Footer, Logo, NavMenu, MobileNav). These ARE allowed bare-element selectors inside their own scoped class.
- `ui/admin/styles/Admin/AdminDarkMode.scss` — the admin shell's mode-overlay; explicitly scoped to `body.admin-dark` already.
- `_` partials imported via `@use` — fine.

### The audit

1. Walk every `*.scss` file outside the allowed-globals list. For each, check that all top-level rules either:
   - sit under a component-root class (`.hero`, `.footer`, `.modal-…`)
   - are at-rules (`@use`, `@forward`, `@mixin`, `@function`, `@keyframes`)
   - are nested within `@supports` / `@media` blocks (still requiring component-scoped inner selectors).

2. Flag every offender. Report the file + line + rule.

3. Fix each by wrapping the offending rule under the component's root class. Where a rule was *intentionally* cross-cutting (a known bleed-by-design), document the intent inline with a `// CROSS-FILE: …` comment AND move the rule to `globals/` or `Common/`.

### The sweep

Mechanical. Apply the audit's findings:
- Wrap escapes under the root class.
- Move intentionally cross-cutting rules to `globals/` / `Common/`.
- Add `stylelint` rules to enforce the invariant going forward (configurable severity = error). Use `selector-no-qualifying-type` + a custom rule that requires the first compound in every top-level selector to start with `.<file-stem-kebab>` or be in the allow-list.

## Files to touch

- `ui/client/modules/<Module>/<Module>.scss` — per-module sweep
- `ui/client/features/<Feature>/<Feature>.scss` — per-feature sweep
- `ui/client/styles/Common/*.scss` — confirm scope (mostly fine)
- `ui/client/styles/globals/*.scss` — receives any rules promoted out of components
- `ui/admin/styles/**/*.scss` — same sweep on the admin side
- `.stylelintrc.json` (new or extend) — enforce the rule

## Acceptance

- A new `tools/scripts/scss-scope-audit.ts` (or similar) runs in CI and fails the build if a per-component SCSS file has top-level rules outside its component root class.
- `stylelint` with the new rule passes on the whole codebase.
- Visual baselines (when captured) match pre-sweep — refactor only, no design changes.
- Manual smoke test on the preview server: every module renders identically.

## Risks / notes

- Some "cross-bleed" might be load-bearing — e.g. a `Hero.scss` rule that styles `.image` inside `.hero` happens to also match an unrelated `.image` outside, and removing it visually breaks the unrelated element. Mitigation: visual baseline capture before the sweep + diff after.
- AntD class overrides (`.ant-btn`, `.ant-modal-…`) are inherently cross-cutting. They belong under the component's root class (`.theme-editor .ant-btn { … }`) so they don't escape. Audit the existing `ui/admin/styles/Admin/AdminDarkMode.scss` for the right pattern.
- Ant Design's CSS-in-JS (CSS variables emitted by `ConfigProvider`) is orthogonal and should NOT be touched.

## Effort

**L · 2-3 engineering days**

- Audit script + initial inventory: 0.5 day
- Per-file sweep (likely 30-50 SCSS files): 1-1.5 days
- Promoted rules to `globals/` + `Common/`: 0.5 day
- Stylelint rule + CI hook: 0.5 day

## Open questions

1. **Stylelint vs custom AST script** — stylelint has a plugin ecosystem and editor support; a custom script is more flexible. Recommend stylelint with `stylelint-scss` + a tiny custom plugin that enforces the file-stem-as-root-class rule. Decide at implementation.
2. **Visual baseline order** — capture baselines BEFORE the sweep so per-module diff is visible? Currently visual baseline capture is blocked on Windows worker fanout; this audit can run anyway, with manual smoke as the verification gate.
3. **Promoted-rule destination** — which globals file gets promoted bleed rules? Recommend creating `ui/client/styles/globals/cross-cutting.scss` so the promotion is explicit and reviewable, instead of dumping into an existing global.
