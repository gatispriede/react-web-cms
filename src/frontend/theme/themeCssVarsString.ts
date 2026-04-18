import {IThemeTokens} from '../../Interfaces/ITheme';

const COLOR_VARS: Array<[keyof IThemeTokens, string[]]> = [
    ['colorPrimary', ['--theme-colorPrimary', '--primary']],
    ['colorBgBase', ['--theme-colorBgBase', '--background']],
    ['colorTextBase', ['--theme-colorTextBase']],
    ['colorSuccess', ['--theme-colorSuccess']],
    ['colorWarning', ['--theme-colorWarning']],
    ['colorError', ['--theme-colorError']],
    ['colorInfo', ['--theme-colorInfo']],
];

const NUM_VARS: Array<[keyof IThemeTokens, string, string]> = [
    ['borderRadius', '--theme-borderRadius', 'px'],
    ['fontSize', '--theme-fontSize', 'px'],
    ['contentPadding', '--theme-contentPadding', 'px'],
];

const COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^rgb|^hsl/;

/**
 * Returns the body of a `:root { ... }` rule (without selector / braces) for the
 * given theme tokens. Safe to inline in server-rendered `<style>` so the first
 * paint picks up theme vars — mirrors the client runtime in `applyThemeCssVars`.
 */
export function buildThemeCssVarsBody(tokens: IThemeTokens | null | undefined): string {
    if (!tokens) return '';
    const lines: string[] = [];
    for (const [token, vars] of COLOR_VARS) {
        const v = tokens[token];
        if (typeof v === 'string' && v && COLOR_RE.test(v)) {
            for (const name of vars) lines.push(`${name}:${v};`);
        }
    }
    for (const [token, name, unit] of NUM_VARS) {
        const v = tokens[token];
        if (typeof v === 'number' && Number.isFinite(v)) lines.push(`${name}:${v}${unit};`);
    }
    return lines.join('');
}

export function buildThemeCssVarsRule(tokens: IThemeTokens | null | undefined): string {
    const body = buildThemeCssVarsBody(tokens);
    return body ? `:root{${body}}` : '';
}
