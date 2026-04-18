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
    [key: string]: string | number | undefined;
}

export interface ITheme {
    id: string;
    name: string;
    tokens: IThemeTokens;
    custom: boolean;
}

export interface InTheme {
    id?: string;
    name: string;
    tokens: IThemeTokens;
    custom?: boolean;
}
