# Build / Pages

The **Build** pane (`/admin/build`) is where pages are composed. Each page is a list of **sections**; each section is a 1–10 column slot grid that holds **modules** (also called items).

## Anatomy

- **Page** — a navigation entry. Top-level; appears in the site's nav bar (or as an anchor in scroll mode). Has SEO metadata and an ordered list of section ids.
- **Section** — `{type: 1–10, slots: [...], content: [items]}`. `type` is the total column width; `slots` partitions it (e.g. `[1, 2]` on a `type: 3` section gives a 1/3 + 2/3 split). `content.length` must equal `slots.length`.
- **Item / module** — a typed payload (`Hero`, `RichText`, `ProjectCard`, …) rendered by the matching React component under `ui/client/modules/<Type>`.

## Common operations

- **Add a section** — pick a layout (1–10 columns, optional split). Drops in with empty modules.
- **Add a module** — open the module picker on an empty slot. Modules are filtered by enabled features.
- **Reorder** — drag sections in the page outline; drag modules between slots in the same section.
- **Overlay** — toggle on a section to stack its modules over the previous section (used for hero overlays).

## Layout modes

Site-wide setting (Settings → Layout):

- **Tabs** — each page is its own route (`/about`, `/contact`).
- **Scroll** — every page is a section of `/`, accessed by `#anchor`. Useful for single-page sites; page links rewrite to anchors at runtime.

## Validation

The schema validator in `shared/utils/contentSchemas.ts` runs on every section save. RichText cannot exceed 200 KB; image refs must be a local `api/` path or an `https://` URL; per-module field types are enforced.
