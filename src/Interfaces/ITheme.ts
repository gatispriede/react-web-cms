export interface IThemeTokens {
    colorPrimary?: string;
    colorBgBase?: string;
    colorTextBase?: string;
    colorSuccess?: string;
    colorWarning?: string;
    colorError?: string;
    colorInfo?: string;
    borderRadius?: number;
    fontSize?: number;
    /** Site-wide content padding in px, applied to every section except full-bleed modules. */
    contentPadding?: number;
    // ---- Extended design tokens (optional, used by editorial presets like "Paper") ----
    /** Inset background for cards / quotes / portrait tiles. */
    colorBgInset?: string;
    /** Softer body text color (labels, meta). */
    colorInkSecondary?: string;
    /** Ambient/supporting text (timestamps, coords). */
    colorInkTertiary?: string;
    /** Thin dashed/solid separator colour. */
    colorRule?: string;
    /** Heavier separator colour (baseline rules). */
    colorRuleStrong?: string;
    /** Accent (e.g. rust) — different from `colorPrimary` so AntD primary stays calm. */
    colorAccent?: string;
    /** Foreground colour to put on top of the accent. */
    colorAccentInk?: string;
    /** Translucent accent used for highlighter/mark backgrounds. */
    colorMark?: string;
    /** Display serif (headings, big quotes). */
    fontDisplay?: string;
    /** Monospace (labels, meta, ticks). */
    fontMono?: string;
    /** Sans (body). */
    fontSans?: string;
    /** Machine-readable slug for SCSS theme-scoping (`body[data-theme-name="<slug>"]`). */
    themeSlug?: string;
    [key: string]: string | number | undefined;
}

export interface ITheme {
    id: string;
    name: string;
    tokens: IThemeTokens;
    custom: boolean;
    editedBy?: string;
    editedAt?: string;
}

export interface InTheme {
    id?: string;
    name: string;
    tokens: IThemeTokens;
    custom?: boolean;
}
