# Simplified vs Advanced admin UI

Status: Planned
Last updated: 2026-04-29

## What it is

Two admin UI modes baked into the admin shell:

- **Simplified** — minimal, opinionated, mandatory-only. Targets non-technical users (the marketing person, the small-business owner). Shows only the actions that need doing.
- **Advanced** — the current admin: every setting, every module, every flag, every dev-grade affordance.

The mode is per-user (stored on `IUser`), with an admin-only override on a per-installation default. A simplified-mode user never sees the advanced surface; an advanced-mode user can switch to simplified to "see what the customer sees" but isn't restricted.

## Why bake it into the architecture

If we don't, simplified mode becomes a fork. Every new admin component would need to remember "render the simple variant if mode === simplified." Bake it into the `AdminShell` so individual feature panes declare *what they expose at each level* and the shell composes the right view.

## Sketch

### Mode declaration

Each admin feature pane exports a small `adminPane` descriptor:

```ts
export const productsPane: AdminPaneDescriptor = {
  id: 'products',
  title: 'Products',
  icon: ProductIcon,
  modes: {
    simplified: {
      // Only the actions a non-technical operator needs.
      view: ProductsSimplifiedView,    // list, "add product", basic edit
    },
    advanced: {
      view: ProductsAdvancedView,      // current Products.tsx
    },
  },
};
```

A feature can:
- Provide both modes (most common).
- Provide advanced only — pane is hidden in simplified mode.
- Provide simplified only — rare, but supported.

### What "simplified" means in practice

Per-feature, opinionated reductions:

| Feature | Simplified mode shows |
|---|---|
| Pages / sections | Page list, "Add page", edit text + images via inline editing only. No module reorder, no style picker. |
| Products | Product list, "Add product" form with title/price/image/description only. No variants, no attributes table, no warehouse fields. |
| Themes | "Pick a preset" (4 cards). No token editing. |
| Translations | Inline-edit-as-you-browse only. No CSV editor, no key list. |
| Orders | Recent orders list, mark shipped / mark delivered. No state-machine view, no refunds (admin-only anyway). |
| Inventory | "Sync now" button + last-sync status. No adapter config. |
| Cart | (no admin UI in either mode) |
| MCP / Audit / Bundle / Settings | Hidden in simplified mode entirely. |

### Mode storage

- `IUser.adminUiMode: 'simplified' | 'advanced' | null` (null = follow site default).
- `siteSettings.defaultAdminUiMode` — admin sets the install-wide default.
- Top-bar mode switcher visible only to advanced-mode users.

### Mandatory actions

Simplified mode surfaces a "Things to do" panel on the dashboard — first-run nudges that disappear when satisfied:
- Set up the site name + logo.
- Pick a theme.
- Add at least one page or product.
- Add a customer-support email.

This is the AI-agent friendly entry point: an MCP `site.checkOnboarding` tool returns the same list.

## Goals

- Architecture-level: every feature pane declares its own simplified / advanced split. The shell never `switch`es on `mode`.
- New features must declare a simplified variant or be flagged "advanced-only" — it's a code-review check, not a runtime one.
- Simplified mode is fast to navigate: one nav rail, no search, big primary actions.
- An operator can bounce a single user from simplified → advanced as a "promote" action without changing their role.

## Open questions

1. **Mode vs role** — is "simplified" really a UI mode or is it a role like `viewer`? The difference: roles gate writes; modes gate complexity. Keep them separate even though they correlate (most simplified users are editor-rank; most advanced users are admin-rank).
2. **MCP / CLI behaviour** — should the MCP tool surface honour the user's mode? Probably no — MCP callers are always advanced/operator-grade. The mode is a UI affordance.
3. **Component duplication risk** — providing both `ProductsSimplifiedView` and `ProductsAdvancedView` means two components per feature. Pattern alternative: one component with a `mode` prop and tagged JSX. Decide which scales better — the per-mode component is cleaner; the prop variant is shorter to write.
4. **First-time setup wizard overlap** — the "Things to do" panel partly overlaps with the queued go-to-market onboarding flow. Build the panel once and have the onboarding wizard reuse it.
5. **Translation strategy** — simplified labels need their own translation keys (different copy from advanced). New `admin.simplified.*` namespace.
