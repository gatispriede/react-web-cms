import type {ThemeConfig} from 'antd';
import staticTheme from './themeConfig';
import {IThemeTokens} from '../../Interfaces/ITheme';

export function buildThemeConfig(tokens: IThemeTokens | null | undefined): ThemeConfig {
    if (!tokens) return staticTheme;
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(tokens)) {
        if (v !== undefined && v !== null && v !== '') cleaned[k] = v;
    }
    return {token: cleaned};
}
