export interface IMagicLinkAccountUpgrade { title?: string; body?: string; ctaLabel?: string; extra?: Record<string, unknown>; }
export enum EMagicLinkAccountUpgradeStyle {
    Default = 'default',
    Compact = 'compact',
    Banner = 'banner',
    Card = 'card',
    Stamp = 'stamp',
}
