import type {ThemeConfig} from 'antd';
import staticTheme from './themeConfig';
import {IThemeTokens} from '@interfaces/ITheme';

/**
 * AntD consumes only a fixed set of token keys and runs colour math on them
 * (alpha blends, hover / active states, derived bg tokens). That math expects
 * legacy hex/rgb/hsl — modern spaces like `oklch()` break it and the computed
 * tokens come out black / transparent (dropdown menus, selectors, ghost
 * buttons go unstyled).
 *
 * Extended editorial tokens (`colorInkSecondary`, `colorRule`, `fontDisplay`,
 * `themeSlug`…) belong in CSS vars only — not here.
 */
const ANTD_COLOR_TOKENS = new Set<string>([
    'colorPrimary',
    'colorBgBase',
    'colorTextBase',
    'colorSuccess',
    'colorWarning',
    'colorError',
    'colorInfo',
]);
const ANTD_NUMBER_TOKENS = new Set<string>(['borderRadius', 'fontSize']);
const COMPATIBLE_COLOR = /^#[0-9a-fA-F]{3,8}$|^rgb|^hsl/;

export function buildThemeConfig(tokens: IThemeTokens | null | undefined): ThemeConfig {
    if (!tokens) return staticTheme;
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(tokens)) {
        if (v === undefined || v === null || v === '') continue;
        if (ANTD_COLOR_TOKENS.has(k)) {
            if (typeof v === 'string' && COMPATIBLE_COLOR.test(v)) cleaned[k] = v;
            // oklch / lab / color() values: skip — let AntD fall back to defaults
            // so its derived tokens (colorBgElevated, colorBorder, colorFillAlter)
            // stay valid. CSS vars already carry the modern-space value for the
            // custom SCSS to consume.
        } else if (ANTD_NUMBER_TOKENS.has(k)) {
            if (typeof v === 'number') cleaned[k] = v;
        }
        // Other token keys are editorial extras consumed via CSS vars only.
    }
    return {token: cleaned};
}
