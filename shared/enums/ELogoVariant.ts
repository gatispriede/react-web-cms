/**
 * Logo asset variants — the *image* options operators can upload, distinct from
 * the visual treatment encoded by `ELogoStyle` (bordered / framed / circle).
 *
 * Themes declare a preferred lockup via `IThemeManifest.logoLockup` which the
 * public renderer uses to pick a variant when one isn't pinned by the caller.
 * Every variant gracefully falls back to `Full` (the historical single-image
 * slot), which itself falls back to the dashed `◆` mark — so existing single-
 * image content keeps working unchanged.
 *
 * Variant intent:
 * - `Full`      — primary logo (icon + wordmark, full colour). Default fallback.
 * - `Icon`      — bare mark only — for tight slots (favicon stand-in, mobile
 *                 collapsed header, app-tab badge).
 * - `Mono`      — single-colour variant — for dark backgrounds, footers,
 *                 print, or overlay contexts where the full-colour mark fights
 *                 the surface.
 * - `Wordmark`  — text-only lockup — for themes whose `logoLockup` declares
 *                 `'wordmark'` (e.g. editorial, agency).
 */
export enum ELogoVariant {
    Full = 'full',
    Icon = 'icon',
    Mono = 'mono',
    Wordmark = 'wordmark',
}

/**
 * Where the logo is being rendered. Drives variant selection when the caller
 * doesn't pin a specific variant: header uses the theme's preferred lockup,
 * footer prefers `Mono`, mobile-collapsed prefers `Icon`.
 */
export enum ELogoContext {
    Header = 'header',
    Footer = 'footer',
    MobileCollapsed = 'mobile-collapsed',
    Error = 'error',
}
