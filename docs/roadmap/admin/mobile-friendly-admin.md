# Mobile-friendly admin

## Goal

The admin SPA at `/admin` is currently desktop-first — fixed sider, multi-column section editors, drag-reorder via mouse, image rail expecting a wide canvas. On a phone the operator either can't reach controls (sider clips, action strip overflows) or can't perform the gesture (drag-reorder, dropdown). Goal is **operator-grade editing on a phone**, not just "renders without horizontal scroll." Specifically: an operator should be able to fix a typo, swap a hero image, publish, and answer an inquiry from their phone without bouncing to a laptop.

This is a UX-correctness project, not a responsive coat of paint. Real success looks like the operator opening admin on their phone at a coffee shop and shipping a content fix in under two minutes.

**Shipped as one chunk.** The shell, the editors, and the polish all land together. There's no useful "halfway" state — a drawer without responsive editors is still unusable; PWA install without 44 px touch targets still fails on first interaction. One feature, one PR (or one tightly-grouped commit chain), one merge.

## Design

Three subsystems, all in scope of the single deliverable.

### Shell + navigation

- **Sider becomes a drawer below 768 px.** Slides in from the left over content, dismissed by overlay tap or a top-bar close button. Uses the same flattened `openKeys[]` controlled state (from the 2026-05-04 click-parent refactor) — no new tree component.
- **Top bar shrinks to icons + active tab label.** Keep the autosave dot, audit badge, undo pill, user bar — collapse into an overflow menu on narrow widths. Brand mark stays leading.
- **Bottom safe-area handling.** iOS Safari's bottom bar overlaps fixed action strips today; reserve `env(safe-area-inset-bottom)` on the action cluster.
- **Tab/pane scroll inside its own container.** The shell stays fixed; only the active pane's body scrolls. Without this, the autosave dot and undo pill disappear off-screen mid-edit.

### Section / module editors

- **Every multi-column editor row collapses via the same drawer-style accordion as the public site** below 768 px. Reuses the shared `@mixin section-row-collapsible` from `ui/client/styles/Common/_responsive.scss` (defined in [mobile-column-behavior.md](../platform/mobile-column-behavior.md) — public side ships the mixin first). First column visible, subsequent columns collapsed under a chevron-rotate toggle matching `MobileNav.scss`'s pattern. Two-column inputs (`Label · Value`) stack with `min-height: 44px` per row when they're inside a collapsed drawer body.
- **InlineEdit (Alt+click) → long-press fallback.** Alt isn't a thing on phones; long-press (~500 ms) opens the same editor.
- **Drag-reorder gets explicit up/down/move-to controls.** Already partially shipped (`a12c7b6`); confirm those are the canonical mobile path and remove the `@dnd-kit` dependency on touch in admin (still ok for the public-site preview pane).
- **Image rail switches from horizontal scroll to a tray.** Below 768 px the rail folds into a sticky-bottom tray button that opens a full-screen sheet with a 2-column grid; tap to insert into the active editor, instead of drag-from-rail.
- **Modals → bottom sheets.** AntD `Modal` is fine on desktop; on phones use a bottom-sheet variant (still AntD, but `placement` + max-height). Action dialogs (delete confirm, idempotency hint) also.
- **Form fields hit 44×44 px touch targets.** Audit the existing sizes; AntD's `size="middle"` is 36 px which fails iOS HIG — bump to `size="large"` below 768 px (or override the height token via the existing theme bridge).

### Cross-cutting polish

- **Presence avatars stack vertically** when the cluster overflows — already a nice-to-have on desktop, becomes mandatory on mobile.
- **PWA installable shell.** `manifest.json` exists for the public site; add an admin manifest (`/admin/manifest.json`) so the operator can "Add to Home Screen" — feels like a native app, gets full-bleed without browser chrome.
- **Pull-to-refresh in the inquiry list.** Native gesture; cheap to add, surprisingly missed when absent.
- **Visual regression sweep.** When `Q4-cap` lands, capture mobile baselines too — every change here would otherwise regress silently.

## Files to touch

**Shell**
- `ui/admin/shell/AdminShell.tsx` (or equivalent — the sider/top-bar layout)
- `ui/admin/styles/Admin/Shell.scss` (drawer breakpoint, safe-area)
- `ui/admin/shell/AreaNav.tsx` (drawer mode)

**Editors**
- Every file in `ui/admin/modules/*/Editor.tsx` that has a multi-column row (~15 files; most need only a single SCSS rule via the shared `@mixin section-row-collapsible`)
- `ui/admin/lib/inlineEdit.tsx` (long-press)
- `ui/admin/features/Navigation/ImageRail.tsx` (tray + bottom sheet)
- `ui/admin/features/Dialogs/*` (bottom-sheet placements)

**Form / token plumbing**
- `ui/admin/styles/Admin/_tokens.scss` (large-size form heights at narrow widths)
- `ui/client/features/Themes/buildThemeConfig.ts` (responsive `Form.Item` sizing)

**PWA**
- `ui/client/pages/admin/manifest.json` (new)
- `ui/client/pages/admin/_app.tsx` (link to admin manifest, conditional on path)

**Tests**
- New Playwright project for `--device "iPhone 13"` exercising the existing admin specs
- Unit tests for long-press resolver

## Acceptance

1. **Operator round-trip on a phone:** open `/admin` in mobile Safari → edit a hero headline → save → revalidate → see change live on the public site. No horizontal scroll, no off-screen controls, no zoom-to-tap.
2. **Drawer behavior:** sider drawer dismisses on overlay tap, restores last-open keys on next mount, doesn't trap focus when closed.
3. **All AntD form fields ≥44 px tall** at viewport widths ≤480 px (audited via Playwright `toHaveCSS`).
4. **InlineEdit responds to long-press** in addition to Alt+click; 500 ms is the threshold.
5. **Image insertion via tray** works on mobile in at least Hero, RichText, ProjectCard, PlainImage editors (the four most-used image-bearing modules).
6. **PWA install** works on iOS Safari and Android Chrome — the home-screen icon launches admin in standalone mode and the address bar is gone.
7. **No new desktop regressions** — the existing visual baselines (once `Q4-cap` lands) stay green.

## Effort

**L · ~6-8h AI work + on-device QA wall-clock.** Internal time-share for the AI portion: shell ~2h, editors ~3h, polish + PWA ~1h, tests + runbook ~1h. Wall-clock blocker is real-phone QA passes (iOS Safari + Android Chrome) which AI can't compress; budget ~1-2h of human QA time per cycle.

(Pre-AI human estimate was ~5 days realistic.)

## Testids — for e2e

Per the universal `data-testid` rule. All testids land with the chunk:

**Shell**
- `admin-shell-drawer-toggle` — open/close button on the top bar (mobile only)
- `admin-shell-drawer` — the drawer container itself; assert `[data-state="open"|"closed"]`
- `admin-shell-drawer-overlay` — tap-to-dismiss overlay
- `admin-topbar-overflow-toggle` — overflow menu button when controls collapse
- `admin-topbar-active-tab-label` — the breadcrumb/title in the shrunk top bar

**Editors**
- `admin-editor-row-{sectionId}` — every multi-column editor row (parent of collapsed columns)
- `admin-editor-row-toggle-{sectionId}` — the chevron-rotate accordion button
- `admin-editor-row-column-{sectionId}-{n}` — each column inside the row
- `admin-image-tray-toggle` — sticky-bottom tray open button
- `admin-image-tray-sheet` — the bottom-sheet image picker
- `admin-image-tray-tile-{imageId}` — each image in the picker grid
- `admin-modal-{modalName}` — every AntD Modal (now bottom-sheet on mobile) carries its modal-name id
- `admin-form-field-{fieldName}` — every form input wrapper (44px touch target assertion)
- `admin-inline-edit-target-{itemId}` — Alt+click / long-press editable surfaces

**Polish**
- `admin-pwa-install-prompt` — install prompt button (when surfaced)
- `admin-presence-stack` — vertical presence-avatar cluster
- `admin-inquiry-list-pull-refresh` — pull-to-refresh container

E2e coverage targets:
- `tests/e2e/admin/mobile-shell.spec.ts` — drawer open/close, overlay dismiss, safe-area
- `tests/e2e/admin/mobile-editor.spec.ts` — drawer-style row toggle, image tray flow, long-press inline edit
- `tests/e2e/admin/mobile-pwa.spec.ts` — manifest served, install prompt visible, standalone mode after install (limited Playwright support; assert what's testable)

Run with `--device "iPhone 13"` so the breakpoints + touch-event gestures fire.

## MCP coverage

This is admin UI structural work — no new editable content fields. **MCP-exempt.** Existing MCP tools continue to work unchanged; the admin UI just gets phone-friendly.

Edge case: the PWA manifest at `ui/client/pages/admin/manifest.json` is content-shaped (name, icons, theme-color) — but treating it as code-managed (committed JSON) keeps it out of MCP scope. If it ever needs runtime customisation per-tenant, revisit.

## Docs follow-up

- `docs/architecture/admin-shell.md` — document the breakpoint, drawer behavior, and the shared `@mixin section-row-collapsible` reuse so the next dev knows where the responsive primitives live.
- `docs/runbooks/mobile-admin-qa.md` (new) — operator-facing checklist for testing admin on a phone (devices to cover, gestures to verify, PWA install verification).
- Update `docs/roadmap/shipped.md` on merge.

## Out of scope for v1

- Native iOS / Android wrapper. Web works fine; a Capacitor / React Native shell is a separate roadmap item (see [`backlog.md`](../backlog.md)) if the value emerges.
- Offline editing. Admin requires fresh server state for conflict-aware writes; offline mode would need a complete optimistic-concurrency rewrite.
- Touch gestures for drag-reorder. The explicit up/down/move-to model is the canonical path on all viewports going forward.
