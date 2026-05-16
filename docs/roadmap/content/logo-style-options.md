# Logo — theme-aware style variants

> **SHIPPED 2026-05-16 (multi-variant asset slots — full / icon / mono / wordmark)** —
> the spec's second jump landed. `ILogoContent` extended with a `variants`
> record (`Partial<Record<ELogoVariant, ILogoVariantAsset>>`); `ELogoVariant`
> enum at `shared/enums/ELogoVariant.ts` defines `Full | Icon | Mono | Wordmark`,
> `ELogoContext` defines `Header | Footer | MobileCollapsed | Error`. Public
> renderer (`ui/client/features/Logo/Logo.tsx`) picks a variant via
> `pickLogoVariant(context, lockup)` using the active theme's `logoLockup`
> (now plumbed through `IThemeTokens.logoLockup` → `body[data-logo-lockup]`
> by `applyThemeCssVars`). `resolveLogoVariantSrc` falls back through requested
> variant → `Full` → legacy `src` → `◆` mark, so existing single-image content
> keeps working unchanged. Admin Logo settings (`ui/admin/features/Logo/LogoSettings.tsx`)
> gained per-variant upload slots beneath the primary image. `Lockup` was
> renamed `combined` in the manifest contract for `'mark-only' | 'wordmark' | 'combined'`;
> picker treats `combined`/unset as `Full`. Unblocks first-class-themes'
> remaining 5 themes since they can now declare `logoLockup` and operators
> can upload distinct lockups per surface.

> **Shipped (2026-04-24)** — the site-wide top-bar Logo (now at
> `ui/client/features/Logo/Logo.tsx`, not a section module — see reshape)
> accepts a `style` field persisted in the Logo JSON. Variants `default`,
> `bordered`, `framed`, `circle` land via `.logo--<style>` class. All tokens
> (`--logoBorderColor`, `--logoBorderWidth`, `--logoFrameBg`, `--logoShadow`,
> `--logoRadius`) fall back through theme → hardcoded defaults, so variants
> work on every existing theme without touching the preset JSONs. Admin Theme
> → Logo tab gained a Style select (Default / Bordered / Framed / Circle).
> `Transparent` deferred — it's a cross-cutting concern already covered by C8.

## Goal

Give the Logo section real presentational options so a brand can choose a
framed / transparent / bordered treatment without custom CSS per client.
Today the Logo section renders a bare `<img>` with no variants.

## Design

### New `ELogoStyle` enum

```ts
export enum ELogoStyle {
  Default      = 'default',      // bare image, current behaviour
  Bordered     = 'bordered',     // thin accent-coloured border + padding
  Framed       = 'framed',       // card-like: bg + shadow + radius
  Transparent  = 'transparent',  // force transparent bg even if source has one
  Circle       = 'circle',       // clipped round — for avatar-style marks
}
```

Start with three new ones (user asked "at least 3"): **Bordered, Framed,
Circle**. Transparent is a cross-cutting concern — see
[module-transparency-style.md](module-transparency-style.md) — and will be
applied via that mechanism, not as a Logo-specific style.

### Tokens

All borders / shadows / radii read from theme tokens, so swapping the theme
updates logos automatically:

- `--logoBorderColor` → falls back to `--colorPrimary`
- `--logoBorderWidth` → default `2px`
- `--logoFrameBg` → falls back to `--colorBgContainer`
- `--logoShadow` → falls back to theme `boxShadow`
- `--logoRadius` → falls back to `--borderRadius`

### SCSS

One SCSS block per variant under `scss/Components/Logo.scss`:

```scss
.logo {
  &.logo--bordered { border: var(--logoBorderWidth) solid var(--logoBorderColor); padding: 0.25rem; }
  &.logo--framed   { background: var(--logoFrameBg); box-shadow: var(--logoShadow); border-radius: var(--logoRadius); padding: 0.5rem; }
  &.logo--circle   { border-radius: 50%; aspect-ratio: 1 / 1; object-fit: cover; }
}
```

### Admin UI

Extend the existing `AddNewSectionItem.tsx` style dropdown (already renders
enum-based `EStyle` options for other sections) to support per-section-type
enums. Logo gets its own.

## Files to touch

- `shared/types/ILogo.ts` (or wherever Logo's data type lives) — add
  `style: ELogoStyle`
- `src/Enums/ELogoStyle.ts` — new
- `ui/client/modules/Logo.tsx` — apply class from style
- `ui/client/styles/Components/Logo.scss` — new or extend
- `ui/admin/features/AddNewSectionItem.tsx` — support per-type
  style enums (small plumbing)
- `ui/admin/modules/InputLogo.tsx` — style picker

## Acceptance

- All three new styles render correctly across the four existing themes
  (Paper, Studio, Industrial, HighContrast)
- Style change in admin reflects on public page after save
  (covered by [production-caching.md](../platform/production-caching.md) revalidation)
- Circle variant handles non-square source images gracefully (`object-fit`)
- Bordered variant's colour updates when theme's `colorPrimary` changes
- Keyboard-accessible style dropdown (re-uses existing component, so free)

## Depends on / pairs with

- [module-transparency-style.md](module-transparency-style.md) — transparency
  is the sibling concept, handled generically.
- [themes-as-files.md](../platform/themes-as-files.md) — new tokens need listing in the
  theme JSON schema.

## Effort

**S** — 1–3 h. Enum + SCSS + small admin plumbing. Most of the time is theme
smoke-tests across four presets.
