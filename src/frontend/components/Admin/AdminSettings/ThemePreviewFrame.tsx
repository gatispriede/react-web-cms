import React, {CSSProperties, useMemo} from 'react';
import {IThemeTokens} from '../../../../Interfaces/ITheme';

/**
 * Mini "page in miniature" rendered inside a Theme card so editors can tell
 * themes apart at a glance. Fixed ~240×180 frame with hero headline + meta
 * strip + primary button + body paragraph + rule separator — enough surfaces
 * to see bg, ink, accent, rule, display + mono fonts.
 *
 * Scoping contract: tokens are declared as inline CSS custom properties on
 * a wrapper div, and `data-theme-name={themeSlug}` sits on the same wrapper.
 * All theme SCSS files use `[data-theme-name="x"]` (without the `body`
 * ancestor), so module overrides from Paper / Studio / Industrial render
 * correctly inside the preview — exactly what the editor will see after
 * activating.
 */
const CSS_VAR_MAP: Array<[keyof IThemeTokens, string[]]> = [
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

const NUM_VAR_MAP: Array<[keyof IThemeTokens, string, string]> = [
    ['borderRadius', '--theme-borderRadius', 'px'],
    ['fontSize', '--theme-fontSize', 'px'],
    ['contentPadding', '--theme-contentPadding', 'px'],
];

function tokensToStyle(tokens: IThemeTokens | undefined): CSSProperties {
    const style: Record<string, string> = {};
    if (!tokens) return style as CSSProperties;
    for (const [token, vars] of CSS_VAR_MAP) {
        const v = tokens[token];
        if (typeof v === 'string' && v) for (const name of vars) style[name] = v;
    }
    for (const [token, name, unit] of NUM_VAR_MAP) {
        const v = tokens[token];
        if (typeof v === 'number') style[name] = `${v}${unit}`;
    }
    return style as CSSProperties;
}

const ThemePreviewFrame: React.FC<{
    tokens: IThemeTokens | undefined;
    themeName: string;
    /** Width in px. Height derives from a fixed 4:3 aspect so the frame stays compact. */
    width?: number;
}> = ({tokens, themeName, width = 240}) => {
    const tokenStyle = useMemo(() => tokensToStyle(tokens), [tokens]);
    const slug = typeof tokens?.themeSlug === 'string' ? tokens?.themeSlug : '';
    const height = Math.round((width * 3) / 4);

    // Inner scale factor — mini page thinks it's ~560 px wide, then we shrink
    // the whole group with transform: scale so text proportions stay right
    // instead of all rendering at the same 11 px baseline.
    const innerWidth = 560;
    const scale = width / innerWidth;

    return (
        <div
            className="theme-preview-frame"
            data-theme-name={slug}
            style={{
                ...tokenStyle,
                width,
                height,
                overflow: 'hidden',
                borderRadius: 6,
                border: '1px solid rgba(0,0,0,0.08)',
                position: 'relative',
                background: 'var(--theme-colorBgBase, var(--background, #fff))',
                color: 'var(--theme-colorTextBase, var(--ink, #1f1f1f))',
                fontFamily: 'var(--font-sans, system-ui, sans-serif)',
                cursor: 'default',
                userSelect: 'none',
            }}
            aria-label={`${themeName} theme preview`}
        >
            <div
                style={{
                    width: innerWidth,
                    transformOrigin: 'top left',
                    transform: `scale(${scale})`,
                    padding: '24px 28px',
                    boxSizing: 'border-box',
                }}
            >
                <div style={{
                    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                    fontSize: 11,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-3, var(--theme-colorInkTertiary, rgba(0,0,0,0.5)))',
                    marginBottom: 10,
                }}>
                    § Theme preview
                </div>

                <h1 style={{
                    fontFamily: 'var(--font-display, var(--font-sans, system-ui))',
                    fontSize: 42,
                    lineHeight: 1,
                    margin: 0,
                    letterSpacing: '-0.02em',
                    color: 'var(--theme-colorTextBase, var(--ink, inherit))',
                }}>
                    Quick brown fox.
                </h1>

                <div style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'center',
                    marginTop: 14,
                    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2, var(--theme-colorInkSecondary, rgba(0,0,0,0.65)))',
                }}>
                    <span>Est. 2026</span>
                    <span style={{
                        width: 28,
                        height: 1,
                        background: 'var(--rule-strong, var(--theme-colorRuleStrong, currentColor))',
                    }}/>
                    <span>Serif + Mono</span>
                </div>

                <p style={{
                    fontSize: 13,
                    lineHeight: 1.55,
                    marginTop: 14,
                    marginBottom: 16,
                    color: 'var(--ink-2, var(--theme-colorInkSecondary, inherit))',
                }}>
                    A body paragraph — the kind that fills a section once content lands.
                    Just enough to show how ink, rules, and the accent colour breathe.
                </p>

                <hr style={{
                    border: 0,
                    borderTop: '1px solid var(--rule, var(--theme-colorRule, rgba(0,0,0,0.12)))',
                    margin: '0 0 14px',
                }}/>

                <button
                    type="button"
                    tabIndex={-1}
                    style={{
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: 'calc(var(--theme-borderRadius, 6px))',
                        fontFamily: 'inherit',
                        fontSize: 13,
                        fontWeight: 500,
                        background: 'var(--accent, var(--theme-colorPrimary, #1677ff))',
                        color: 'var(--accent-ink, var(--theme-colorBgBase, #fff))',
                        cursor: 'default',
                    }}
                >
                    Primary action
                </button>
            </div>
        </div>
    );
};

export default ThemePreviewFrame;
