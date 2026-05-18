import type {IThemeTokens} from '../ITheme';

/**
 * First-class theme manifest — Wave 5 infrastructure.
 *
 * A `theme.json` file under `services/themes/<slug>/` is parsed into this
 * shape at boot by `ThemeRegistry`. Each first-class theme ships:
 *   - per-slug directory at `services/themes/<slug>/`
 *   - `theme.json`             — this manifest (light + dark palette, fonts,
 *                                motion overrides, header/footer hints,
 *                                module-style hints)
 *   - `theme.scss`             — semantic-token overrides scoped under
 *                                `[data-theme-name="<slug>"]`
 *   - `module-styles.scss`     — per-module override layer (signature
 *                                components, scroll behaviour, hover states)
 *   - `README.md`              — design doc + Stitch-frames slot
 *
 * The manifest is the canonical contract between admin UI, runtime
 * `applyThemeCssVars`, and the per-theme SCSS layer. Predefined enums are
 * preferred over free-text strings — see
 * `feedback_predefined_selections.md`.
 *
 * Visual design is intentionally **deferred** in this jump — only schema +
 * three placeholder themes (editorial, agency, commerce) ship. Real Stitch
 * passes land per-theme in subsequent jumps via the `theme.scss` slot.
 */

/** Header scroll behaviour — predefined enum, per-theme decision. */
export type ThemeHeaderBehavior =
    | 'sticky-static'
    | 'shrink-on-scroll'
    | 'hide-on-down-show-on-up'
    | 'centered-hero-integrated';

/** Footer layout hint — predefined enum. */
export type ThemeFooterLayout =
    | 'minimal-1row'
    | 'multi-column'
    | 'brand-led-xxl';

/** Logo lockup — kept narrow per logo-style-options.md (default to A — pure CSS). */
export type ThemeLogoLockup = 'wordmark' | 'mark-only' | 'combined';

/** Motion personality preset — drives `--motion-duration-*` / easing overrides. */
export type ThemeMotionProfile =
    | 'gentle-slow'
    | 'snappy-default'
    | 'expressive-bold'
    | 'reduced-static';

/**
 * Palette pair — light + dark mode values consumed by the per-theme SCSS as
 * `light-dark(<light>, <dark>)`. Mode = brightness, theme = identity:
 * orthogonal axes.
 */
export interface IThemePalette {
    /** Page background. */
    surface: {light: string; dark: string};
    /** Body ink / text colour. */
    ink: {light: string; dark: string};
    /** Brand accent — used for CTAs, links, highlights. */
    accent: {light: string; dark: string};
    /** Foreground ink to place on top of `accent`. */
    accentInk: {light: string; dark: string};
    /** Inset surface (cards, quotes, secondary blocks). */
    surfaceInset: {light: string; dark: string};
    /** Rule / divider colour. */
    rule: {light: string; dark: string};
}

/** Typography — display + body + mono font stacks. */
export interface IThemeTypography {
    display: string;
    body: string;
    mono: string;
    /** Base font size in px (consumed as `var(--theme-fontSize)`). */
    baseSize?: number;
}

/**
 * Per-module style hint — opt-in flags consumed by `module-styles.scss`. Most
 * themes leave the slot empty; the hint set documents what a theme *intends*
 * to override so subsequent SCSS passes have a contract to match.
 */
export interface IThemeModuleStyleHints {
    hero?: 'oversized-type' | 'photo-bleed' | 'video-bg' | 'split-text-media';
    productGrid?: 'tight-grid' | 'catalogue-card' | 'scroll-snap';
    timeline?: 'broken-grid' | 'vertical-rail' | 'horizontal-scroll';
    posts?: 'editorial' | 'card-grid' | 'list';
}

/**
 * First-class theme manifest — parsed from `services/themes/<slug>/theme.json`.
 */
export interface IThemeManifest {
    /** URL-safe slug — must match the directory name. Drives `[data-theme-name=…]`. */
    slug: string;
    /** Display name shown in the admin theme picker. */
    name: string;
    /** Short one-liner shown under the theme tile in the preset gallery. */
    tagline: string;
    /** Target audience (e.g. "Writers, photographers, journalism"). */
    audience: string;
    /** Mood adjectives (3-5). */
    mood: readonly string[];
    /** Light + dark palette. */
    palette: IThemePalette;
    /** Typography stacks. */
    typography: IThemeTypography;
    /** Motion personality preset — drives W0b motion-token overrides. */
    motion: ThemeMotionProfile;
    /** Header scroll behaviour hint. */
    headerBehavior: ThemeHeaderBehavior;
    /** Footer layout hint. */
    footerLayout: ThemeFooterLayout;
    /** Logo lockup hint (default 'combined'). */
    logoLockup?: ThemeLogoLockup;
    /** Per-module style hints. */
    moduleStyleHints?: IThemeModuleStyleHints;
    /** Whether the theme defaults to dark-mode (agency / saas-landing). */
    darkDefault?: boolean;
    /** Placeholder flag — true for themes awaiting their Stitch design pass. */
    placeholder?: boolean;
    /** Stitch frames link — populated once the design pass lands. */
    stitchFramesUrl?: string;
}

/**
 * Project a manifest down to the legacy `IThemeTokens` shape used by
 * `ThemeService` / `applyThemeCssVars`. Picks the light-mode values from each
 * palette pair — runtime swaps dark via the `light-dark()` SCSS function in
 * the per-theme `theme.scss`.
 */
export function manifestToTokens(m: IThemeManifest): IThemeTokens {
    return {
        colorPrimary: m.palette.accent.light,
        colorBgBase: m.palette.surface.light,
        colorTextBase: m.palette.ink.light,
        colorAccent: m.palette.accent.light,
        colorAccentInk: m.palette.accentInk.light,
        colorBgInset: m.palette.surfaceInset.light,
        colorRule: m.palette.rule.light,
        fontDisplay: m.typography.display,
        fontSans: m.typography.body,
        fontMono: m.typography.mono,
        fontSize: m.typography.baseSize ?? 16,
        themeSlug: m.slug,
        logoLockup: m.logoLockup,
    };
}
