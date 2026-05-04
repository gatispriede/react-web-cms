# Test ID convention (`data-testid`)

Single source of truth for how `data-testid` attributes are named across the admin shell. Both Playwright specs and the JSX instrumentation follow the same composition rule — there is no central registry to look up. If you can read this doc, you can write or read any testid.

## The rule

```
<feature>-<element>[-<context>]-<role>
```

Lowercase. Hyphen-separated. Trailing `role` is mandatory. Optional `context` slots between `element` and `role` only when the element isn't unique on its own.

| Slot | What it is | Examples |
|---|---|---|
| **feature** | The admin-shell area, usually 1:1 with `ui/admin/features/<X>/`. | `nav`, `section`, `module-editor`, `themes`, `bundle`, `products`, `orders`, `inventory`, `mcp`, `users`, `audit`, `posts`, `languages` |
| **element** | The specific UI piece within. | `page`, `module`, `picker`, `list`, `row`, `dialog`, `tab`, `field`, `option`, `add`, `delete`, `edit`, `save`, `cancel`, `import`, `export`, `submit` |
| **context** *(optional)* | Disambiguator — slug, type, id, name. Use when the element repeats. | `<slug>`, `<theme-id>`, `rich-text`, `hero`, `gallery` |
| **role** | The element's interactive type. Always last. | `btn`, `input`, `textarea`, `select`, `checkbox`, `link`, `tab`, `pane`, `row`, `cell`, `dialog`, `card`, `file-input` |

## Examples

```
nav-add-page-btn               — "Add page" button on Navigation pane
nav-page-name-input            — page-name input inside the Add/Edit page dialog
nav-page-save-btn              — Save button inside that dialog
nav-page-row-<slug>            — row in the page list for a specific slug
section-add-module-btn         — "Add module" trigger on the page editor
section-module-picker-hero     — Hero option in the module-type picker
section-module-row-rich-text   — RichText row in the section's module list
section-module-edit-rich-text-btn  — edit affordance on the RichText row
section-save-btn               — section-level save (if exposed)
module-editor-primary-text-input — canonical "main text field" of any module's editor
module-editor-save-btn         — save in the module editor
themes-list-row-<id>           — single row in the themes list
themes-set-active-btn          — set-active action on the active row
bundle-import-btn              — opens the import flow
bundle-import-file-input       — file input inside that dialog
bundle-import-submit-btn       — submit on the import dialog
```

## Composing in Playwright specs

Use the `tid()` helper from `tests/e2e/fixtures/testIds.ts`:

```ts
import {tid, byTid} from '../fixtures/testIds';

await byTid(page, tid('nav', 'add', 'page', 'btn')).click();
await byTid(page, tid('nav', 'page', 'name', 'input')).fill('about');
await byTid(page, tid('nav', 'page', 'save', 'btn')).click();
```

For module-type pickers and rows, normalize the `EItemType` enum value:

```ts
import {tid, byTid, moduleTypeSlug} from '../fixtures/testIds';
import {EItemType} from '@enums/EItemType';

const slug = moduleTypeSlug(EItemType.RichText);   // "rich-text"
await byTid(page, tid('section', 'module', 'picker', slug)).click();
```

That's the entire API. There is no `T` lookup table — call sites construct the testid from the rule.

## Adding `data-testid` in JSX (the agent's job)

When instrumenting the admin shell, follow the rule literally. No need to import any helper — the testid is just a string:

```tsx
// AddNewDialogNavigation.tsx
<Button data-testid="nav-add-page-btn" onClick={open}>{t('admin.nav.addPage')}</Button>
<Input data-testid="nav-page-name-input" value={name} onChange={…} />
<Button data-testid="nav-page-save-btn" type="primary" onClick={save}>{t('save')}</Button>

// SectionPageList.tsx — repeating element needs `context`
{pages.map(p => (
    <Row key={p.slug} data-testid={`nav-page-row-${p.slug}`}>{p.name}</Row>
))}

// ModulePicker.tsx — derive context from the enum
{Object.values(EItemType).map(t => (
    <Button
        key={t}
        data-testid={`section-module-picker-${t.toLowerCase().replace(/_/g, '-')}`}
        onClick={() => addModule(t)}
    >
        {t}
    </Button>
))}
```

## When the rule isn't enough

Two narrow exceptions:

1. **Generic "primary text field" per module editor.** Different module types render different field shapes (`headline` for Hero, `value` for RichText, `body` for Manifesto, etc.). The chain spec needs *one* selector that works across all of them. The convention reserves `module-editor-primary-text-input` as that canonical handle. Each module's editor JSX must put `data-testid="module-editor-primary-text-input"` on whichever field is the meaningful single text input for that module. Modules without a single text field (Image / Gallery / Carousel / ProjectCard) simply don't have it — specs must check `count() > 0` before filling.

2. **Iteration helpers.** When listing N rows, build the row's testid from a stable id (slug, theme id, sku). Don't use the array index — the next reorder breaks the test. If the rendered data has no stable id, surface one (use the Mongo `id` field).

## Anti-patterns

- ❌ Don't put display text in the testid: `nav-add-new-page-button-en` (locale-coupled, unstable)
- ❌ Don't use camelCase: `navAddPageBtn` (split rule wrong)
- ❌ Don't omit the role: `nav-add-page` (ambiguous — link? button? icon?)
- ❌ Don't use array indexes for `context`: `themes-list-row-2` (reorder breaks)
- ❌ Don't reuse the same testid for multiple elements: each testid is unique on the page

## Reading testids back

The reverse mapping is intentional: a testid you see in DevTools tells you exactly where to look in the source.

- `nav-page-save-btn` → `ui/admin/features/Navigation/`, save button on the page dialog
- `themes-set-active-btn` → `ui/admin/features/Themes/`, active-theme switcher
- `bundle-import-file-input` → `ui/admin/features/Bundle/`, file input in the import dialog

If you can't find the source by following `feature-element` → folder convention, the testid is wrong (probably missed a `feature` prefix).

## Admin top-bar area nav (Phase 1 of admin segregation)

The six area entries in the admin top bar (added by Phase 1 of
`docs/features/platform/admin-segregation.md`) carry these testids — each one
sits on the `<Button>` link in `ui/admin/shell/UserStatusBar.tsx`:

- `nav-area-build-link` — `/admin/build`
- `nav-area-client-config-link` — `/admin/client-config`
- `nav-area-content-link` — `/admin/content`
- `nav-area-seo-link` — `/admin/seo`
- `nav-area-release-link` — `/admin/release`
- `nav-area-system-link` — `/admin/system`

### Area-internal sub-page rail (Phase 2)

Each area page renders a vertical `<AreaNav/>` rail listing its sub-pages
(`ui/admin/shell/AreaNav.tsx`). Each rail link carries a testid of the form
`nav-<area>-<sub>-link`:

- Build:    `nav-build-pages-link`, `nav-build-modules-preview-link`
- Client config: `nav-client-config-themes-link`, `nav-client-config-logo-link`, `nav-client-config-layout-link`
- Content:  `nav-content-translations-link`, `nav-content-posts-link`, `nav-content-footer-link`, `nav-content-products-link`, `nav-content-inventory-link`, `nav-content-orders-link`
- Release:  `nav-release-publishing-link`, `nav-release-bundle-link`, `nav-release-audit-link`
- System:   `nav-system-users-link`, `nav-system-mcp-link`, `nav-system-inquiries-link`

The legacy `admin-settings-tab-<x>` testids on individual settings tabs are
preserved inside `AdminSettings.tsx` for the (302-redirected) `/admin/settings`
fallback. The smoke spec stops using them — each step navigates to its
sub-page URL directly.
