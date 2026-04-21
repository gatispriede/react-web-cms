# Admin systems

Supplementary reference for admin-only subsystems that don't fit cleanly into the request lifecycle or data model docs.

## Admin i18n (decoupled from site language)

The admin chrome runs its own `i18next` instance (`adminI18n`) separate from the public site's translation bundle.

- **Locale resolution order:** `user.preferredAdminLocale` → `localStorage.admin.locale` → browser language header → `en`.
- **Translation bundles** live at `src/frontend/admin-locales/{en,lv}.json` — checked into git, no external CMS.
- A three-letter chip in `UserStatusBar` lets each admin switch locale without affecting the published site language.
- Adding a new admin locale requires adding the JSON file and registering the locale code in the selector.

## Inline translation editing

Any translated string wrapped in `<InlineTranslatable>` emits `<span data-i18n-key="…" data-i18n-source="…">` in the DOM.

- **`<InlineTranslationHost>`** is mounted once at `_app.tsx` and installs a document-level `Alt+click` listener.
- Clicking any tagged span opens `<InlineTranslationEditor>` — a floating popover showing the current value and key.
- Enter / Save commits via `LanguageApi.saveLanguage`; the page re-renders without a full reload via `i18n.reloadResources` + `changeLanguage`.
- Long strings (> 200 chars) render a 4-row textarea; Ctrl+Enter to save.
- The feature is flag-gated: `siteFlags.inlineTranslationEdit` toggled in admin → Layout tab.

## Icon system

All icons are centralised in `src/frontend/components/common/icons.tsx`.

- **`lucide-react`** is the sole icon library. `@ant-design/icons` and `styled-icons` are banned by ESLint `no-restricted-imports`.
- The mapping file re-exports lucide icons under their former AntD names (`EditOutlined`, `DeleteOutlined`, …) so call-sites need no changes after the migration.
- **`IconBase` adapter** forces 16 px, sets `strokeWidth: 1.75`, and adds `verticalAlign: -0.125em` for text-inline alignment.
- `*Filled` variants set `fill="currentColor"` on the underlying SVG.
- `LoadingOutlined` applies `@keyframes lucide-spin` automatically.

To add a new icon: import from `lucide-react`, wrap in `IconBase`, export from `icons.tsx`. Never import lucide directly in a component.

## Drag-and-drop architecture

Two separate DnD mechanisms coexist:

### Section-level and intra-section reorder (`@dnd-kit`)

`DraggableWrapper` uses `@dnd-kit/core` + `@dnd-kit/sortable` with three sensors:

| Sensor | Activation |
|---|---|
| `PointerSensor` | 8 px movement |
| `TouchSensor` | 250 ms hold + 5 px tolerance |
| `KeyboardSensor` | `sortableKeyboardCoordinates` strategy |

Auto-scroll near viewport edges is enabled by `<DndContext>` defaults. A pulsing `.section-drop-indicator` accent bar marks the active drop target. Intra-section item reorder uses `<SortableList>` across all 8 array-backed section configs.

### Image rail → section drops (native HTML5 `dataTransfer`)

The fixed-position image rail uses native `dragstart` / `drop` events rather than dnd-kit. This sidesteps the dnd-kit context boundary limitation that would otherwise prevent dragging from a portal into a section's drop target. `useImageDrop` provides the handler pair for target elements.

## Google Fonts proxy (GDPR self-hosting)

When `siteFlags.selfHostFonts` is enabled, font requests are routed through two internal API routes instead of hitting Google's CDN directly:

| Route | Purpose |
|---|---|
| `/api/fonts/css` | Proxies the Google Fonts CSS, rewrites font file URLs to point to `/api/fonts/file` |
| `/api/fonts/file` | Proxies the binary font file |

Caching policy: CSS — 1-day public + 7-day stale-while-revalidate; binaries — 1-year immutable.

Visitor IP and User-Agent are never forwarded to Google; only the server's IP makes the upstream call. The public site's `_document.tsx` builds a single `<link>` URL via `buildGoogleFontsUrl()`, deduplicating against `BUNDLED_FAMILIES` to avoid loading fonts that are already in the bundle.

The Google Fonts catalogue JSON at `src/frontend/data/google-fonts.json` is refreshed via `Scripts/update-google-fonts.ts` (pulls from the Google Fonts Developer API; run manually when the catalogue needs updating).

Last reviewed: 2026-04-21.
