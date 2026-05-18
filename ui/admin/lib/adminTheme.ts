import {theme as antdTheme} from 'antd';
import type {ThemeConfig} from 'antd';
import staticTheme from '@client/features/Themes/themeConfig';

/**
 * Admin AntD theme — the global-first dark-mode token set.
 * Per `docs/roadmap/admin/admin-dark-mode-audit.md` (step 4).
 *
 * The audit's load-bearing decision: fix dark mode at the *token* layer
 * via `ConfigProvider`, NOT with per-component CSS overrides. AntD's
 * `darkAlgorithm` already derives a usable dark palette, but it leaves a
 * few legibility gaps the audit flagged (muted text too dim against the
 * elevated surfaces, borders disappearing, mask not dark enough). This
 * module pins those tokens explicitly for *both* algorithms so the base
 * palette renders correctly everywhere before any per-feature work.
 *
 * `cssVar: {key: 'admin'}` (set in `AdminApp`) exposes every token below
 * as a `--ant-color-*` custom property, which `AdminDarkMode.scss` +
 * `AppLoginWrapper.scss` consume — so the SCSS chrome and the AntD
 * components share one palette instead of drifting as two systems.
 */

/** Shared base tokens — apply in both light and dark. */
const baseToken: NonNullable<ThemeConfig['token']> = {
    ...staticTheme.token,
    // Slightly tighter radius reads more "operator tool" than the AntD
    // default; harmless in both modes.
    borderRadius: 6,
};

/** Light-mode token overrides. Mostly defaults — light mode was already
 *  fine; pinned here so the two modes are visibly symmetric and any
 *  future light-mode tuning has a home. */
const lightToken: NonNullable<ThemeConfig['token']> = {
    ...baseToken,
    colorBgLayout: '#f5f5f5',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorText: 'rgba(0, 0, 0, 0.88)',
    colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
    colorTextTertiary: 'rgba(0, 0, 0, 0.45)',
    colorBorder: '#d9d9d9',
    colorBorderSecondary: '#f0f0f0',
};

/**
 * Dark-mode token overrides. These are the audit's "global fix pass" —
 * tuned on top of `darkAlgorithm`'s derived palette to clear the
 * contrast failures: text stays ≥ WCAG AA against the container +
 * elevated surfaces, borders remain visible, and the two surface
 * elevations (`Container` vs `Elevated`) are distinguishable.
 */
const darkToken: NonNullable<ThemeConfig['token']> = {
    ...baseToken,
    // Three distinct elevations so siblings don't render identically.
    colorBgLayout: '#141414',
    colorBgContainer: '#1d1d1d',
    colorBgElevated: '#262626',
    // Text ramp — AntD dark defaults skew too dim for the elevated
    // chrome surfaces; bump each tier up one notch.
    colorText: 'rgba(255, 255, 255, 0.88)',
    colorTextSecondary: 'rgba(255, 255, 255, 0.68)',
    colorTextTertiary: 'rgba(255, 255, 255, 0.50)',
    colorTextQuaternary: 'rgba(255, 255, 255, 0.34)',
    // Borders — AntD dark border is near-invisible on the elevated
    // surface; lift it so table grids / card edges stay legible.
    colorBorder: '#3a3a3a',
    colorBorderSecondary: '#2a2a2a',
    // Mask — darker so modals/drawers read as clearly layered.
    colorBgMask: 'rgba(0, 0, 0, 0.65)',
    // Links — the default dark link blue is fine; pin hover so it
    // doesn't wash out on the darker container.
    colorLink: '#4ea1ff',
    colorLinkHover: '#74b8ff',
};

/**
 * Component-level overrides. Kept deliberately thin — the audit's rule
 * is "tokens first, components only where a token can't reach." Every
 * value here references the token layer (no hardcoded hex) so both
 * modes stay correct.
 */
const components: ThemeConfig['components'] = {
    Layout: {
        // The admin shell paints its own chrome; keep Layout transparent
        // so it inherits the active mode's layout background.
        bodyBg: 'transparent',
        headerBg: 'transparent',
        siderBg: 'transparent',
    },
    Table: {
        // Header sits on the elevated surface so it reads as chrome
        // distinct from the row body in both modes.
        headerBg: 'var(--ant-color-bg-elevated)',
        headerColor: 'var(--ant-color-text)',
        borderColor: 'var(--ant-color-border)',
        rowHoverBg: 'var(--ant-color-fill-tertiary)',
    },
    Tabs: {
        itemColor: 'var(--ant-color-text-secondary)',
        itemSelectedColor: 'var(--ant-color-text)',
        itemHoverColor: 'var(--ant-color-text)',
    },
    Modal: {
        headerBg: 'var(--ant-color-bg-elevated)',
        contentBg: 'var(--ant-color-bg-container)',
    },
    Drawer: {
        // Drawer body intentionally left to default container bg — the
        // editor surface inside drawers mirrors public-side components.
    },
    Menu: {
        itemBg: 'transparent',
        subMenuItemBg: 'transparent',
    },
};

/**
 * Build the `ConfigProvider` `theme` prop for the current mode.
 * `cssVar: {key: 'admin'}` is what makes the tokens above available as
 * `--ant-color-*` CSS custom properties to the admin SCSS layer.
 */
export function buildAdminTheme(dark: boolean): ThemeConfig {
    return {
        cssVar: {key: 'admin'},
        algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: dark ? darkToken : lightToken,
        components,
    };
}

export {lightToken, darkToken};
