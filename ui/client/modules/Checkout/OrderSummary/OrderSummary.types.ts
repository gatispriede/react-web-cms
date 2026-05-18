export interface IOrderSummary { title?: string; extra?: Record<string, unknown>; }
export enum EOrderSummaryStyle {
    Default = 'default',
    Compact = 'compact',
    Card = 'card',
    Receipt = 'receipt',
    Minimal = 'minimal',
}
