export interface IReferAFriendCta { title?: string; body?: string; ctaLabel?: string; ctaHref?: string; extra?: Record<string, unknown>; }
export enum EReferAFriendCtaStyle {
    Default = 'default',
    Compact = 'compact',
    Card = 'card',
    Banner = 'banner',
    Stamp = 'stamp',
}
