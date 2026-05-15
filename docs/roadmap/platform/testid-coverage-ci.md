---
name: testid-coverage-ci
description: Implement the missing `tools/scripts/testid-coverage.mjs` CI script that enforces universal requirement #4 — `data-testid` attribute on every interactive surface in new / modified `.tsx` files. Today the gate is review-checked; this script automates it.
---

# `data-testid` coverage CI

> **Shipped 2026-05-14.** `tools/scripts/testid-coverage.mjs` (AST-walk via
> `@typescript-eslint/parser`), `testid-coverage.test.mjs` (10 passing unit
> tests), `.testid-coverage-allow`, the `testid-coverage` + `testid-coverage:test`
> npm scripts, and the PR-only `data-testid coverage (changed files)` step in
> `.github/workflows/ci.yml` are all in place. **Hard gate** — the CI step runs
> `npm run testid-coverage` (diff mode), which exits non-zero on any
> missing-`data-testid` violation in changed `.tsx` files. Naming-convention
> mismatches are warn-only, as specced. Current tree: ~856 full-tree violations
> / ~526 in diff-mode against `origin/master` — these are the legacy backlog the
> diff-mode gate deliberately *doesn't* sweep; only new/modified files are gated.
> The optional `data-edit-target` second gate is **not** implemented — deferred
> to land with [admin-inline-editing.md](../admin/admin-inline-editing.md), which
> introduces the attribute. See [shipped.md](../shipped.md).

## Goal

Universal requirement #4 in [README.md](../README.md) mandates `data-testid` on every interactive surface — buttons, inputs, options, list items with identity, modals, drawer toggles, status indicators. Today this is review-checked.

Ship the CI script that automates it: `tools/scripts/testid-coverage.mjs` walks new + modified `.tsx` files, flags interactive elements lacking `data-testid`, fails the build with a clear violations list.

## Why now

- The audit (2026-05-12) flagged this as the only universal-requirement gate without CI enforcement.
- 44 new modules are landing across the storefront program ([new-modules-catalogue.md](../_meta/new-modules-catalogue.md)). Manual review will miss testids; automation catches them at PR time.
- Inline-editing ([admin-inline-editing.md](../admin/admin-inline-editing.md)) needs `data-edit-target` on every editable field — a sibling check can land in the same script.

## Design

### What counts as "interactive"

The walker looks for:

- HTML primitives — `<button>`, `<a>`, `<input>`, `<select>`, `<textarea>`, `<details>`, `<summary>`
- AntD interactives — `<Button>`, `<Input>`, `<Select>`, `<Modal>`, `<Drawer>`, `<Tabs>`, `<Menu>`, `<Form.Item>`, `<Switch>`, `<Radio>`, `<Checkbox>`, `<DatePicker>`, `<TimePicker>`, `<Upload>`, `<Tag.CheckableTag>`
- Custom interactives — components with `onClick` / `onChange` / `onSubmit` props at the call site
- Role-marked elements — anything with `role="button"` / `role="tab"` / `role="link"` / `role="checkbox"` / etc.

### What's allowed without testid

Static decorative elements (`<div>` without `onClick`, `<span>` text wrappers, icon-only display with no handler) — out of scope.

### Naming-convention check

Past the presence check, the script also validates the testid value against the [naming convention](../README.md#universal-requirements--every-roadmap-item):

- Lowercase, kebab-case
- At least two `-` separated segments (`feature-component-role` minimum)
- Allowed identity suffix: `-{id}` where `id` matches `[a-z0-9_-]+`
- State suffix `-{state}` allowed but prefer `data-state` attribute

Violations are warnings, not failures (looser gate than presence).

### CI integration

Two run modes:

- **Per-PR diff mode** — analyses changed `.tsx` files via `git diff origin/master...HEAD`. Fast (~5s on a typical PR). Default in `.github/workflows/ci.yml`.
- **Full-tree scan** — runs over all `.tsx` files in `ui/`. Slower (~30s). Used by a scheduled weekly run + `--all` flag for ops.

Output format — same as `mcp-schema-drift.mjs`:

```
✗ data-testid coverage check FAILED
  3 files with violations (5 total)

ui/client/modules/CarListingCard/CarListingCard.tsx:42
  <button onClick={...}>Reserve</button>  — missing data-testid

ui/admin/features/Releases/ReleaseDetail.tsx:118
  <Button onClick={...}>Publish</Button>  — missing data-testid

ui/admin/features/Releases/ReleaseDetail.tsx:124
  <Drawer onClose={...}>  — missing data-testid

ui/client/features/AccountDashboard/SavedSearches.tsx:67
  <input onChange={...} />  — missing data-testid

ui/admin/shell/CommandPalette/CommandPalette.tsx:89
  ⚠ data-testid="cmdK-bar" doesn't follow feature-component-role convention
    suggestion: "command-palette-bar" or "shell-commandpalette-bar"
```

### Implementation approach — AST walk via `@typescript-eslint/parser`

Don't roll a regex parser. Use the same parser ESLint uses:

```ts
import {parse} from '@typescript-eslint/parser';
import {readFile} from 'node:fs/promises';

async function scanFile(path: string): Promise<Violation[]> {
    const code = await readFile(path, 'utf8');
    const ast = parse(code, {jsx: true, range: true, loc: true});
    const violations: Violation[] = [];
    walkJsx(ast, (node) => {
        if (isInteractive(node) && !hasTestid(node)) {
            violations.push({path, line: node.loc.start.line, kind: 'missing', node: formatNode(node)});
        }
    });
    return violations;
}
```

The walker recognises both string-literal `data-testid="x"` and dynamic `data-testid={...}` forms. Dynamic forms count as present (we trust the runtime value; the static-analysis gate is presence-of-attribute).

### Allowlist

Some files are excluded from the check via a `tools/scripts/.testid-coverage-allow` file (one path-pattern per line):

```
ui/client/modules/*/i18n/**
ui/admin/features/Debug/**
**/*.test.tsx
**/*.stories.tsx
**/_archived/**
```

Tests + Storybook stories don't need testids on their interactive elements.

### Pair: `data-edit-target` check (optional second gate)

Same script, second pass: for every JSX element rendering a content-bearing field (string from `content.X`, image from `content.imageX`), check it carries `data-edit-target`. This gate is **warn-only** during the inline-editing rollout; flip to error once [admin-inline-editing.md](../admin/admin-inline-editing.md) lands.

## Files to touch

- `tools/scripts/testid-coverage.mjs` (new) — main script
- `tools/scripts/testid-coverage.test.mjs` (new) — unit tests on a fixture file containing known violations
- `tools/scripts/.testid-coverage-allow` (new) — allowlist patterns
- `.github/workflows/ci.yml` — add `testid-coverage` step after `test-and-typecheck`, fails build on violations
- `package.json` — add `testid-coverage` npm script + `@typescript-eslint/parser` dev dep
- `docs/roadmap/README.md` — universal-requirements section updates to note CI is now enforcing this gate
- `docs/roadmap/agent-handoff-format.md` — Pattern G updated with CI-failure example

## Starter code

```js
#!/usr/bin/env node
import {parse} from '@typescript-eslint/parser';
import {readFile} from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {glob} from 'glob';
import path from 'node:path';

const INTERACTIVE_TAGS = new Set([
    'button', 'a', 'input', 'select', 'textarea', 'details', 'summary',
    'Button', 'Input', 'Select', 'Modal', 'Drawer', 'Tabs', 'Menu',
    'Switch', 'Radio', 'Checkbox', 'DatePicker', 'TimePicker', 'Upload',
]);

function hasOnHandler(attrs) {
    return attrs.some((a) => a.type === 'JSXAttribute' && /^on[A-Z]/.test(a.name?.name ?? ''));
}

function hasTestid(attrs) {
    return attrs.some((a) => a.type === 'JSXAttribute' && a.name?.name === 'data-testid');
}

function walkJsx(node, visit) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXOpeningElement') visit(node);
    for (const k of Object.keys(node)) {
        const v = node[k];
        if (Array.isArray(v)) v.forEach((c) => walkJsx(c, visit));
        else if (v && typeof v === 'object') walkJsx(v, visit);
    }
}

async function scanFile(filePath) {
    const code = await readFile(filePath, 'utf8');
    const ast = parse(code, {jsx: true, range: true, loc: true, errorOnUnknownASTType: false});
    const violations = [];
    walkJsx(ast, (node) => {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (!name) return;
        const interactive = INTERACTIVE_TAGS.has(name) || hasOnHandler(node.attributes);
        if (!interactive) return;
        if (hasTestid(node.attributes)) return;
        violations.push({
            path: filePath,
            line: node.loc.start.line,
            tag: name,
        });
    });
    return violations;
}

async function changedFiles() {
    const out = execSync('git diff --name-only --diff-filter=AM origin/master...HEAD', {encoding: 'utf8'});
    return out.split('\n').filter((p) => p.endsWith('.tsx'));
}

async function allFiles() {
    return glob('ui/**/*.tsx', {ignore: ['**/_archived/**', '**/*.test.tsx', '**/*.stories.tsx']});
}

async function main() {
    const mode = process.argv.includes('--all') ? 'all' : 'diff';
    const files = mode === 'all' ? await allFiles() : await changedFiles();
    const allViolations = [];
    for (const f of files) {
        try {
            const v = await scanFile(f);
            allViolations.push(...v);
        } catch (err) {
            console.error(`parse failed: ${f}: ${err.message}`);
        }
    }
    if (allViolations.length === 0) {
        console.log(`✓ data-testid coverage OK (${files.length} files scanned)`);
        process.exit(0);
    }
    console.error(`✗ data-testid coverage check FAILED`);
    console.error(`  ${allViolations.length} violations in ${new Set(allViolations.map((v) => v.path)).size} files\n`);
    for (const v of allViolations) {
        console.error(`${v.path}:${v.line}\n  <${v.tag}> — missing data-testid`);
    }
    process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(2);
});
```

## Acceptance

1. `npm run testid-coverage` runs against the diff and reports violations
2. `npm run testid-coverage -- --all` runs full-tree scan
3. CI fails on any violation in changed files
4. Allowlist file is consulted and respected
5. Naming-convention warnings emit but don't fail (informational)
6. Unit test fixture contains 5+ known violations + 5+ known-good elements; script catches all violations, doesn't flag any of the good elements
7. Documented in [agent-handoff-format.md](../_meta/agent-handoff-format.md) Pattern G

## Effort

**S · ~1 h AI.** Pure tooling work — AST walk + CI wiring + fixture test.

## Dependencies

- Existing `tools/scripts/mcp-schema-drift.mjs` shape (use as reference for output format + CI integration)
- `@typescript-eslint/parser` (already a project dep)

## Open questions

None.

## Out of scope

- ESLint rule version of this check (would be cleaner long-term — file as a follow-up once we hit ~95% testid coverage across the tree and want the editor to flag in real time)
- Auto-fixer that inserts plausible testids (risky — false-positive prone)
- Coverage report dashboard (CI failure is enough signal)
