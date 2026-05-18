export interface ICheckoutPaymentForm { title?: string; extra?: Record<string, unknown>; }
export enum ECheckoutPaymentFormStyle {
    Default = 'default',
    Compact = 'compact',
    Card = 'card',
    Stacked = 'stacked',
    Boxed = 'boxed',
}
