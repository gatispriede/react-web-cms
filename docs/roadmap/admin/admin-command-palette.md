---
name: admin-command-palette
description: ⌘K command palette via kbar/cmdk across the admin. Every menu action gets a palette entry. Standard keyboard shortcuts (⌘S save, ⌘↵ publish, ? cheatsheet, / inline-search).
research: see research-findings-2026-05-12.md §1 Command palette
---

# Admin command palette + shortcut conventions

> **Status: SHIPPED 2026-05-14.** kbar ⌘K palette live in the admin shell —
> auto-populated from `adminUILoaderRegistry.listAdminPanes()` + `Preview
> site` / `Open blog` utility actions, `KBarProvider` mounted shell-wide in
> `UserStatusBar.tsx` (so ⌘K works from any route), top-bar
> `CommandPaletteTrigger` button, `?` cheatsheet auto-rendered off
> `shortcuts.ts`, `g h`/`g p`/`g t` chords, mobile FAB. The legacy AntD-modal
> `CommandPalette.tsx` was deleted. **Deferred to per-pane fast-follow:** the
> per-feature `useRegisterActions` calls for ⌘S / ⌘↵ / ⌘⇧P / `/` (catalogue
> + cheatsheet already list them; closures land with each editor pane) and
> the e2e smoke spec. See [shipped.md](../shipped.md).

## Goal

Ship a Linear/Sanity-grade command palette that opens with `⌘K` and surfaces every admin action: navigate, create, edit, publish, delete, switch language, switch theme, run MCP tool, jump to documentation.

Pair with a small standard set of keyboard shortcuts so operators can run the admin without touching the mouse for the high-frequency flows.

## Why now

- The admin currently has zero keyboard shortcuts. Operator-grade tools all ship them; absence is felt.
- Pairs perfectly with [admin-toast-system-sonner](admin-toast-system-sonner.md) — kbar action → toast.promise → Undo flow is the operator-grade composition.
- Discoverability boost — operators surface admin capabilities they didn't know existed (we have ~24 features registered; nobody's clicking through 24 sidebar items to find them).

## Design

### Library

**kbar** (lighter, action-graph model, well-suited to our feature-loader registry) over cmdk (more flexible, more code). Choice rationale:

- Our actions are pre-known (one per AdminUILoader pane + a fixed set of doc actions). kbar's static action registration matches.
- Our route shape is shallow — we want fuzzy-match navigation, not Vercel-shop tree navigation. kbar wins on simplicity.

If kbar's accessibility lags cmdk during implementation, pivot to cmdk — both expose the same shape.

### Action graph — auto-populated from loaders

Each `AdminUILoader` already declares `id`, `displayName`, `adminPane.route`. The CommandPalette mounts at AdminApp level and reads from `adminUILoaderRegistry` at first render:

```ts
// ui/admin/shell/CommandPalette/actions.ts
import {adminUILoaderRegistry} from '@admin/lib/loaders/adminUILoaderRegistry';
import type {Action} from 'kbar';
import {router} from 'next/router';

export function buildNavigateActions(): Action[] {
    return adminUILoaderRegistry.loaders.flatMap((loader) => loader.adminPane ? [{
        id: `nav-${loader.id}`,
        name: `Go to ${loader.displayName}`,
        shortcut: [],
        keywords: `navigate ${loader.id} ${loader.displayName.toLowerCase()}`,
        section: 'Navigation',
        perform: () => router.push(loader.adminPane!.route),
    }] : []);
}
```

Each feature pane augments with its own actions via `useRegisterActions()` — e.g. Posts pane registers "Create new post", "Publish current post"; Themes pane registers "Switch to <theme>" per theme.

### Standard shortcuts catalogue

Catalogue lives in `ui/admin/shell/CommandPalette/shortcuts.ts`. Reviewed when adding new ones.

| Shortcut | Action | Scope |
|---|---|---|
| `⌘K` (`Ctrl+K`) | Open command palette | Global |
| `⌘S` | Save active document | Document scope (page/post/product editor) |
| `⌘↵` | Publish active document | Document scope |
| `⌘⇧P` | Preview active document | Document scope |
| `?` | Open shortcut cheatsheet | Global |
| `/` | Focus list search input | List view scope |
| `Esc` | Close active drawer / modal | Global |
| `g h` | Go to home / dashboard | Global (chord) |
| `g p` | Go to Pages | Global (chord) |
| `g t` | Go to Themes | Global (chord) |

### Cheatsheet modal

`?` opens a modal listing every registered shortcut grouped by section. Auto-generated from the actions catalogue + scope rules; no maintenance.

### Mobile behaviour

On mobile (`pointer: coarse`), `⌘K` isn't reachable. The CommandPalette renders a floating action button (bottom-right, theme-tinted) that opens the same palette UI as a full-screen drawer. Mobile palette serves discoverability + bulk navigation; live-typing shortcuts are desktop-only.

## Files to touch

- `package.json` — add `kbar` dep
- `ui/admin/shell/CommandPalette/CommandPalette.tsx` (new) — wraps `<KBarProvider>` + global hotkey binding + UI
- `ui/admin/shell/CommandPalette/actions.ts` (new) — auto-populated navigate actions from registry
- `ui/admin/shell/CommandPalette/shortcuts.ts` (new) — catalogue + cheatsheet content
- `ui/admin/shell/CommandPalette/CommandPalette.scss` (new) — styling matching the active admin theme
- `ui/admin/shell/AdminApp.tsx` — mount `<CommandPalette>` once
- Per-feature: each `<Feature>Pane.tsx` adds `useRegisterActions([{...}], [vm])` for its in-context actions
- `ui/admin/i18n/{en,lv,ru}.json` — palette placeholder + cheatsheet labels
- Tests: e2e spec for ⌘K open + fuzzy nav + ⌘S save + `?` cheatsheet

## Starter code

See **Pattern I** in [agent-handoff-format.md](../_meta/agent-handoff-format.md). Reference auto-population shape above.

## Acceptance

1. `⌘K` opens the palette from any admin route
2. Every `AdminUILoader` pane is reachable from the palette by fuzzy name
3. `⌘S` / `⌘↵` / `⌘⇧P` operate on the focused document editor
4. `?` opens an auto-generated cheatsheet listing every shortcut
5. `/` focuses the list search input on list views
6. Chord shortcuts (`g h`, `g p`, `g t`) navigate
7. Mobile shows a floating action button → opens the palette as a full-screen drawer
8. CommandPalette honours the active dark/light mode + theme tokens
9. Smoke e2e covers: open palette, fuzzy-nav to Themes pane, confirm pane loaded

## Effort

**M · ~2-3 hours AI.** Mostly straight kbar wiring. Per-feature `useRegisterActions` calls can land in the same chunk if light, or as a fast follow-up per pane.

## Open questions

None.

## Out of scope

- Customer-facing client command palette
- AI command palette ("ask the model to do X") — separate item once MCP-client integration is in
