import {IThemeTokens} from '../../Interfaces/ITheme';

const CSS_VAR_MAP: Array<[keyof IThemeTokens, string[]]> = [
    ['colorPrimary', ['--theme-colorPrimary', '--primary']],
    ['colorBgBase', ['--theme-colorBgBase', '--background']],
    ['colorTextBase', ['--theme-colorTextBase']],
    ['colorSuccess', ['--theme-colorSuccess']],
    ['colorWarning', ['--theme-colorWarning']],
    ['colorError', ['--theme-colorError']],
    ['colorInfo', ['--theme-colorInfo']],
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
