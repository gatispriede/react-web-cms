# Admin menu icons — main menu + submenus

## Goal

Every item in the admin shell — main nav bar, settings tabs, page sidebar —
gets a consistent icon next to its label. Today the admin surface is text-only,
which makes scanning slower and the UI feel dated next to the public site
(which already uses iconography via `@client/lib/icons`).

Icons are decoration + affordance, never a replacement for the label.

## Design

### Icon source

Reuse the existing `ui/client/lib/icons.tsx` adapter (lucide-react wrapped
behind AntD-ish names like `EditOutlined`). No new dependency. Pick icons that
already ship in lucide; extend the adapter only if a concept is genuinely
missing.

### Placement rules

- **Before the label**, `gap: 8px`, vertically centered.
- Size: `1em` (inherits from the button/tab text) — icons scale with the host
  control.
- Colour: `currentColor` — themes handle tone; no hardcoded fills.
- Active/hover states already exist on the host control — icons inherit, no
  separate rule needed.

### Main menu (UserStatusBar)

Static JSX, 1:1 mapping:

| Label         | Icon                         |
|---------------|------------------------------|
| App building  | `LayoutOutlined`             |
| Site settings | `SettingOutlined`            |
| Languages     | `GlobalOutlined`             |
| Preview       | `EyeOutlined`                |
| Blog          | `FileTextOutlined` (or `ReadOutlined`) |
| Command       | keep current (already icon-based) |
| Sign out      | `LogoutOutlined`             |

Admin-language dropdown keeps its flag / code — the globe icon on "Languages"
already signals the concept, no need to double up.

### Settings tabs (AdminSettings)

Data-driven — add `icon` alongside `label` / `key` in `getItems()`. AntD Tabs
supports `icon` natively:

| Tab        | Icon                |
|------------|---------------------|
| Users      | `UserOutlined`      |
| Theme      | `BgColorsOutlined`  |
| Logo       | `PictureOutlined`   |
| Layout     | `AppstoreOutlined`  |
| SEO        | `SearchOutlined`    |
| Posts      | `FileTextOutlined`  |
| Footer     | `BorderBottomOutlined` (fallback: `AlignBottomOutlined`) |
| Bundle     | `DownloadOutlined`  |
| Publishing | `CloudUploadOutlined` (already imported elsewhere) |
| Audit      | `AuditOutlined` / `HistoryOutlined` |

### Page sidebar (AdminApp)

Each page entry gets a generic `FileOutlined` by default. If a page's
`iconName` field exists on its navigation record (future enhancement, not in
scope here), use it; otherwise the default. Edit/Delete action icons already
present — no change.

Optional follow-up (separate item, not this one): per-page icon picker in the
navigation editor so admins can pin a meaningful icon per page.

### Accessibility

- Icons are **presentational** — `aria-hidden="true"` on every `<svg>`.
- The label stays the accessible name; screen readers never hear "icon".
- Where a control is icon-only today (Command button), keep the existing
  `aria-label`.

### Theme interaction

Icons use `currentColor`, so they follow button/tab text colour per theme.
No extra token plumbing. Worth an eyeball across all four presets + HighContrast
— part of C10's remit once that lands.

## Files to touch

- `ui/admin/shell/UserStatusBar.tsx` — import + inline icons on each nav button
- `ui/admin/shell/AdminSettings.tsx` — add `icon` to each `getItems()` entry
- `ui/admin/shell/AdminApp.tsx` — default icon on `renderMenuItems()` rows
- `ui/client/lib/icons.tsx` — extend the re-export list if any of the chosen
  lucide names aren't already wrapped (`AuditOutlined`, `BgColorsOutlined`,
  `BorderBottomOutlined`, `LayoutOutlined`, `EyeOutlined`, `GlobalOutlined`,
  `LogoutOutlined`, `ReadOutlined`, `SearchOutlined`, `SettingOutlined`,
  `UserOutlined`, `AppstoreOutlined`, `PictureOutlined`, `FileOutlined`,
  `FileTextOutlined`, `DownloadOutlined`, `HistoryOutlined` — audit before
  adding)

## Acceptance

- Every main-menu button renders an icon left of its label
- Every settings tab renders an icon left of its label
- Page sidebar rows render an icon left of their label
- No layout shift on narrow viewport (mobile nav still collapses cleanly)
- Screen-reader output unchanged (label still announced, icon silent)
- Icons follow theme colour across all presets — no hardcoded hex
- No new dependency — reuses `@client/lib/icons`

## Depends on / pairs with

- [admin-modules-preview-page.md](admin-modules-preview-page.md) (C10) —
  theme-switching matrix is the natural venue to verify icon colour survives
  every theme.

## Effort

**S** — 1–3 h. Mostly picking icons + wiring them into three files. Bulk of
the time is eyeballing the picks so the shell reads as a coherent set, not a
grab-bag.
