export interface ICheckoutCartSummary { title?: string; extra?: Record<string, unknown>; }
export enum ECheckoutCartSummaryStyle {
    Default = 'default',
    Compact = 'compact',
    Mini = 'mini',
    Detailed = 'detailed',
    Card = 'card',
}
