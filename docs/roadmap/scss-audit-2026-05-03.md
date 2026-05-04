# SCSS scope audit — 2026-05-03

Audit step for [F4 SCSS scoping](./scss-scoping.md). Inventory + violation report only — the architectural sweep is a separate task.

## Method

A "violation" is a **top-level** rule whose first compound selector does not start with the file's owning component class (or is not an at-rule / variable). Nested rules under the owner are fine, even if they declare bare element selectors. This matches the spec.

Allow-listed paths (skipped from per-component scoping rule):

- `ui/client/styles/globals/*.scss` — explicit globals
- `ui/client/styles/Common/*.scss` — shared chrome
- `ui/client/styles/Themes/*.scss` (Studio/Industrial/HighContrast/Paper) — `[data-theme-name=...]` rooted; explicitly cross-cutting by spec
- `ui/client/styles/Marketing/landing.scss` — landing page is a single root, contains `:root` token block which is allowed
- `ui/admin/styles/Admin/AdminDarkMode.scss` — `data-admin-theme="dark"` shell overlay

## Summary

| Bucket                                               | Count |
|------------------------------------------------------|-------|
| Total `.scss` files in `ui/`                         | 41    |
| Allow-listed (globals/Common/Themes/Marketing/etc.)  | 14    |
| Per-component files audited                          | 27    |
| Files with at least one top-level violation          | 9     |
| Total top-level violations                           | 18    |

### Violations by type

| Type                                          | Count | Notes |
|-----------------------------------------------|-------|-------|
| Cross-component class at top level            | 9     | e.g. `.section-item-container` inside `PlainImage.scss`, `.gallery-tile--text` inside `Gallery.scss` |
| Bare top-level `@media` with cross-cutting selectors inside | 5 | `Gallery.scss` (×3), `Layout/Content.scss` (×2) |
| Second component root in a per-component file | 3     | `RichText.scss` declares `.rich-text-container-admin`, `ImageDropTarget.scss` declares `.admin-item-drop-host`, `Login.scss` declares `.app-login-wrapper` |
| Bare element / attribute at top level         | 1     | `InlineTranslate.scss` uses `body[data-admin-inline-edit="true"]` (intentional global hook) |

## Per-file table

| Path | Violations | Offending top-level selectors |
|------|-----------:|-------------------------------|
| `ui/client/modules/PlainImage/PlainImage.scss` | 2 | `.section-item-container { &.IMAGE … }`; `.background-image` |
| `ui/client/modules/Gallery/Gallery.scss` | 5 | `.gallery-wrapper.gallery-wrapper-app { &.marquee, &.logo-wall, &.hazard-strip … }` (split root from owner `.gallery-wrapper`); top-level `@media (max-width: 960px) { .gallery-wrapper-app … }` (×2); top-level `@media (max-width: 540px) { .gallery-wrapper-app … }` (×2); `.gallery-tile--text` |
| `ui/client/modules/RichText/RichText.scss` | 1 | `.rich-text-container-admin` (admin-only chrome leaked into public module file) |
| `ui/client/styles/Layout/Content.scss` | 3 | top-level `.section-item-container`; two top-level `@media` blocks each redeclaring `.section-item-container` |
| `ui/client/styles/Themes/Containers.scss` | 1 | `.centerBoxShadow` — file-name doesn't match the only declared class; this is essentially a one-rule chrome partial misfiled into `Themes/` |
| `ui/admin/styles/Admin/AddNewSection.scss` | 2 | `.add-new-section-container` and `.edit-button` are both top-level (file-name root would be `.add-new-section`) |
| `ui/admin/styles/Admin/EditSection.scss` | 4 | `.section-item-container:hover`, `.new-section-wrapper`, `.ant-tabs`, `.dynamic-content` — none match the file stem |
| `ui/admin/styles/Admin/ImageDropTarget.scss` | 1 | `.admin-item-drop-host` (second component root in same file) |
| `ui/admin/styles/Admin/Login.scss` | 1 | `.app-login-wrapper` (second component root in same file) |
| `ui/admin/styles/Admin/InlineTranslate.scss` | 1 | `body[data-admin-inline-edit="true"]` (qualifying type — intentional, but escapes spec) |
| `ui/admin/styles/Admin/InputGallery.scss` | 1 | root is `.gallery-wrapper { &.admin … }`, file-name implies `.input-gallery`. This file owns admin chrome on top of the public `Gallery.scss` — same root by design |
| `ui/admin/styles/Admin/AdminPlainImage.scss` | 1 | root is `.admin-image`, file-stem is `admin-plain-image` → mismatch |
| `ui/admin/styles/Admin/Navigation.scss` | 1 | root is `.navigation-container`, file-stem is `navigation` — mismatch |

Files with no top-level violations (per-component, audited): `Hero.scss`, `Manifesto.scss`, `Testimonials.scss`, `ProjectGrid.scss`, `ProjectCard.scss`, `StatsCard.scss`, `BlogFeed.scss`, `Timeline.scss`, `SkillPills.scss`, `SocialLinks.scss`, `Services.scss`, `InquiryForm.scss`, `InfraTopology.scss`, `PipelineFlow.scss`, `ArchitectureTiers.scss`, `StatsStrip.scss`, `List.scss`, `DataModel.scss`, `RepoTree.scss`, `PlainText.scss`, `Carousel.scss`, `ImageUpload.scss` (single `.image-upload` root).

(Note on per-file counts: the table includes "second-root" entries because the spec is *one component root per file*. The bigger sweep can either split those files or rename the files to match a multi-class root.)

## Worst offenders

### 1. `ui/client/modules/Gallery/Gallery.scss` (5 top-level violations)

Multiple top-level `@media` queries with rules targeting `.gallery-wrapper-app` (a sibling/child class of the owner) outside the owner block:

```scss
@media (max-width: 960px) {
  .gallery-wrapper-app.default .gallery-wrapper-images,
  .gallery-wrapper-app.Default .gallery-wrapper-images {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

Plus the orphan `.gallery-tile--text` block at top level. The file also has *two* top-level `.gallery-wrapper` blocks separated by an unrelated rule. Sweep needs to merge into a single `.gallery-wrapper { … }` root and move the media queries inside it.

### 2. `ui/admin/styles/Admin/EditSection.scss` (4 top-level violations)

The file owns four unrelated component blocks: `.section-item-container:hover`, `.new-section-wrapper`, `.ant-tabs` (raw AntD class!), and `.dynamic-content`. The AntD override is the riskiest — it bleeds onto every `<Tabs>` rendered anywhere with this stylesheet loaded.

```scss
.ant-tabs{
  .ant-tabs-nav-list{
    .edit-wrapper{ … }
  }
}
```

Sweep: move `.ant-tabs` chrome to `AdminDarkMode.scss` or a new `Admin/AdminTabs.scss`; split `.dynamic-content` out into its own file.

### 3. `ui/client/styles/Layout/Content.scss` (3 violations)

Top-level `.section-item-container` width modifiers + two top-level `@media` blocks. The file's owner class is `.content-wrapper` but two-thirds of it styles `.section-item-container`. Sweep: split into `Layout/SectionItemContainer.scss`.

### 4. `ui/client/modules/PlainImage/PlainImage.scss` (2 violations)

```scss
.section-item-container { &.IMAGE { … } }   // cross-component
.background-image { … }                     // unrelated to .plain-image
```

`.background-image` looks like an editor concern that escaped — sweep: move to `globals/cross-cutting.scss` or admin-side.

### 5. `ui/client/modules/RichText/RichText.scss` (1 violation, but high blast radius)

```scss
.rich-text-container-admin {
  .ck-editor__editable { … }
}
```

CKEditor admin chrome inside a public-rendered module file. Sweep: move to `ui/admin/features/Posts/RichTextAdmin.scss` (or wherever admin posts UI lives) and `@use` from there.

## Category-by-category summary for the sweep

The clean way to attack the sweep is by *pattern*, not file-by-file:

1. **Cross-component class at top level (9 cases).** Most are in admin chrome (`AddNewSection`, `EditSection`, `ImageDropTarget`, `Login`). Each file declares 2–4 unrelated component blocks. Fix: one component per file. Split into `<owner>.scss` files matching their first class.

2. **Top-level `@media` queries with cross-cutting bodies (5 cases, all in `Gallery.scss` and `Layout/Content.scss`).** Move the media query *inside* the owner class. SCSS supports `.x { @media (…) { … } }` and the compiled output is identical.

3. **Second component root in a per-component file (3 cases).** `RichText.scss` (admin chrome leaking into public file), `ImageDropTarget.scss`, `Login.scss`. Pattern is "this file owns one publicly-named component plus a related editor/host wrapper." Fix: split into `<file>.scss` + `<file>Admin.scss`.

4. **File-name vs. owner-class mismatches (4 cases).** `AdminPlainImage.scss → .admin-image`, `Navigation.scss → .navigation-container`, `InputGallery.scss → .gallery-wrapper`, `Themes/Containers.scss → .centerBoxShadow`. Either rename file or rename root class. Lowest-risk fix: rename root class.

5. **Bare-element / attribute selectors at top level with intentional cross-cut (1 case).** `InlineTranslate.scss`'s `body[data-admin-inline-edit="true"]` is by design — it must escape per the spec. Move to `globals/cross-cutting.scss` (a new file, but spec said don't create it in this audit task — defer to sweep).

## Quick-win fixes applied in this pass

None. Every violation found is in the "risky" bucket — they all escape the owner and trivially wrapping them under the owner would change the matched DOM (e.g. `.section-item-container` does not currently sit inside `.plain-image`; wrapping it would break the rule). Per the constraint "skip anything where the wrapping changes specificity in a way that might break other selectors", all 18 are deferred to the sweep.

## Stylelint scaffolding (status)

- `stylelint`, `stylelint-scss`, `stylelint-config-standard-scss`, `postcss-scss` added to `devDependencies`
- `.stylelintrc.json` created at repo root with severity = `warning` only
- `npm run lint:scss` script wired
- `selector-no-qualifying-type` enabled at warning (catches `body[data-…]` and similar — 1 hit in `InlineTranslate.scss` today)
- `selector-disallowed-list` placeholder is empty pending the custom rule (deferred per spec open question #1)
- Allow-list paths configured to skip globals / Common / Themes / Marketing / AdminDarkMode

`npm run lint:scss` exits 0 — no errors, just warnings. Build is unaffected.

## Recommended sweep order

1. **Top-level `@media` wrap-ups** (5 cases, no DOM change risk). Mechanical: indent into the owner. Lowest blast radius.
2. **Second-root file splits** (3 cases). Move admin/host blocks into a sibling `<file>Admin.scss` and `@use` from the entry stylesheet.
3. **Multi-component admin files** (`AddNewSection`, `EditSection`, `Login`, `ImageDropTarget` — 9 cases). One file per component; promote AntD overrides into a dedicated `AdminAntdOverrides.scss`.
4. **File-name renames** (4 cases) — purely cosmetic but unblocks the strict stylelint rule.
5. **`Layout/Content.scss` split** — `.section-item-container` rules belong in their own file under `Layout/`.

After the sweep, populate `selector-disallowed-list` and write the custom plugin (or AST script per spec open question #1) that enforces "first compound under top-level rule must start with `.<file-stem-kebab>`", flip severity to `error`, and CI-gate.
