import {IThemeTokens} from '../../Interfaces/ITheme';

const COLOR_VARS: Array<[keyof IThemeTokens, string[]]> = [
    ['colorPrimary', ['--theme-colorPrimary', '--primary']],
    ['colorBgBase', ['--theme-colorBgBase', '--background']],
    ['colorTextBase', ['--theme-colorTextBase', '--ink']],
    ['colorSuccess', ['--theme-colorSuccess']],
    ['colorWarning', ['--theme-colorWarning']],
    ['colorError', ['--theme-colorError']],
    ['colorInfo', ['--theme-colorInfo']],
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

const NUM_VARS: Array<[keyof IThemeTokens, string, string]> = [
    ['borderRadius', '--theme-borderRadius', 'px'],
    ['fontSize', '--theme-fontSize', 'px'],
    ['contentPadding', '--theme-contentPadding', 'px'],
];

// Accept modern color spaces too so oklch/lab/color()-based presets pass through
// SSR unchanged. Font stacks land here via the same function so whitelist them
// as well — browsers parse them natively, and the value is typography, not a
// number, so we aren't risking arithmetic surprises.
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^rgb|^hsl|^oklch|^oklab|^lab|^lch|^color\(/;
const FONT_TOKENS: ReadonlySet<keyof IThemeTokens> = new Set(['fontDisplay', 'fontMono', 'fontSans']);

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
        if (typeof v !== 'string' || !v) continue;
        // Colour tokens must parse as a colour; font tokens are pass-through.
        if (FONT_TOKENS.has(token) || COLOR_RE.test(v)) {
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
