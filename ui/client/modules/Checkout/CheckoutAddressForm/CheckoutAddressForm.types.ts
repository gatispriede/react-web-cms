export interface ICheckoutAddressForm { title?: string; extra?: Record<string, unknown>; }
export enum ECheckoutAddressFormStyle {
    Default = 'default',
    Compact = 'compact',
    Stacked = 'stacked',
    TwoCol = 'two-col',
    Card = 'card',
}
