export interface ICartSummary { title?: string; body?: string; extra?: Record<string, unknown>; }
export enum ECartSummaryStyle {
    Default = 'default',
    Compact = 'compact',
    Card = 'card',
    Sticky = 'sticky',
    Minimal = 'minimal',
}
