# Simplified vs Advanced admin UI

Status: **Foundation shipped 2026-05-02.** Data model (`IUser.adminUiMode`, `siteFlags.defaultAdminUiMode`), GraphQL surface (`myAdminUiMode` / `setMyAdminUiMode`), `useAdminMode()` hook with module-cache + subscriber pattern, top-bar `AdminModeSwitcher` (visible to advanced-mode users only). **All 17 admin panes already respect the mode** — L4 dispatcher resolves `modes.simplified ?? modes.advanced` per user, so the moment a feature ships a simplified variant it lights up automatically. **Remaining**: per-feature simplified-view components (one per pane that wants a cut-down view), MCP execution gate (`enforceModeForTool`), shared "Things to do" panel.
Last updated: 2026-05-02

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

## Decisions (2026-05-02)

1. **Mode vs role** — kept separate. Mode is a UI affordance; role gates writes. Most simplified users will be editor-rank; most advanced users will be admin-rank, but they correlate, not coincide.
2. **Two components per feature** — `ProductsSimplifiedView` + `ProductsAdvancedView` as separate files. Loader declares both. The shell never branches on mode. Clean isolation; advanced view doesn't carry simplified branches.
3. **MCP behaviour: hybrid** — MCP **always exposes the advanced tool surface** (so an AI agent can help any user with anything), but **execution-time gating** consults the calling user's mode and rejects calls that the user wouldn't be able to perform through the UI. Failure mode: a clean `FeatureRestrictedError('mode: simplified — action requires advanced mode')` so the agent can either explain or escalate. This avoids two MCP surfaces while keeping safety on writes.
4. **"Things to do" panel — build once, share.** Component lives under `ui/admin/components/ThingsToDo/`. Used by both the simplified-mode dashboard AND the go-to-market onboarding wizard. The wizard wraps the same component with first-run framing.
5. **Translation strategy: reuse existing `admin.*` keys.** Simplified mode does NOT get its own namespace. Saves translation throughput; cost is occasional copy that's longer/more technical than ideal for simplified users — accept the trade.

## Implementation notes (carry-overs)

- `IUser.adminUiMode: 'simplified' | 'advanced' | null` — null follows site default.
- `siteSettings.defaultAdminUiMode` — admin sets the install-wide default.
- Top-bar mode switcher visible only to advanced-mode users.
- `AdminPaneDescriptor.modes.{simplified, advanced}` — see Class Loader spec; UILoader exports the descriptor.
- MCP execution gate: a small helper `enforceModeForTool(userId, toolId)` called at the top of every advanced tool's resolver; throws `FeatureRestrictedError` if the user is in simplified mode and the tool is flagged `advancedOnly: true`. Tools default to `advancedOnly: true` for any write that isn't surfaced in the simplified UI.
