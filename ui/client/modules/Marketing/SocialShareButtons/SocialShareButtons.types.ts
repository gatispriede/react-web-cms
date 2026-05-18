export interface ISocialShareButtons { title?: string; url?: string; extra?: Record<string, unknown>; }
export enum ESocialShareButtonsStyle {
    Default = 'default',
    Compact = 'compact',
    Pills = 'pills',
    Outlined = 'outlined',
    Branded = 'branded',
}
