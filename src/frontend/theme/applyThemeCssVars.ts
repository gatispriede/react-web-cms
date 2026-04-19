import {IThemeTokens} from '../../Interfaces/ITheme';

const CSS_VAR_MAP: Array<[keyof IThemeTokens, string[]]> = [
    ['colorPrimary', ['--theme-colorPrimary', '--primary']],
    ['colorBgBase', ['--theme-colorBgBase', '--background']],
    ['colorTextBase', ['--theme-colorTextBase', '--ink']],
    ['colorSuccess', ['--theme-colorSuccess']],
    ['colorWarning', ['--theme-colorWarning']],
    ['colorError', ['--theme-colorError']],
    ['colorInfo', ['--theme-colorInfo']],
    // Extended tokens — consumed by design-heavy theme overrides like Paper.
    ['colorBgInset', ['--theme-colorBgInset', '--bg-inset']],
    ['colorInkSecondary', ['--theme-colorInkSecondary', '--ink-2']],
    ['colorInkTertiary', ['--theme-colorInkTertiary', '--ink-3']],
    ['colorRule', ['--theme-colorRule', '--rule']],
    ['colorRuleStrong', ['--theme-colorRuleStrong', '--rule-strong']],
    ['colorAccent', ['--theme-colorAccent', '--accent']],
    ['colorAccentInk', ['--theme-colorAccentInk', '--accent-ink']],
    ['colorMark', ['--theme-colorMark', '--mark']],
    ['fontDisplay', ['--theme-fontDisplay', '--font-display']],
    ['fontMono', ['--theme-fontMono', '--font-mono']],
    ['fontSans', ['--theme-fontSans', '--font-sans']],
];

const NUM_VAR_MAP: Array<[keyof IThemeTokens, string, string]> = [
    ['borderRadius', '--theme-borderRadius', 'px'],
    ['fontSize', '--theme-fontSize', 'px'],
    ['contentPadding', '--theme-contentPadding', 'px'],
];

export function applyThemeCssVars(tokens: IThemeTokens | null | undefined): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (!tokens) return;
    for (const [token, vars] of CSS_VAR_MAP) {
        const v = tokens[token];
        if (typeof v === 'string' && v) {
            for (const name of vars) root.style.setProperty(name, v);
        }
    }
    for (const [token, name, unit] of NUM_VAR_MAP) {
        const v = tokens[token];
        if (typeof v === 'number') root.style.setProperty(name, `${v}${unit}`);
    }
    // Theme slug — drives `[data-theme-name="<slug>"]` scoping for SCSS
    // overrides. Unset when not provided so other presets don't inherit.
    const slug = typeof tokens.themeSlug === 'string' ? tokens.themeSlug : '';
    if (typeof document.body !== 'undefined') {
        if (slug) document.body.setAttribute('data-theme-name', slug);
        else document.body.removeAttribute('data-theme-name');
    }
}

export function resetThemeCssVars(): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    for (const [, vars] of CSS_VAR_MAP) {
        for (const name of vars) root.style.removeProperty(name);
    }
    for (const [, name] of NUM_VAR_MAP) {
        root.style.removeProperty(name);
    }
}
