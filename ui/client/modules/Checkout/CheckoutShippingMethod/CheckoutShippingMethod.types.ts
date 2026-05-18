export interface ICheckoutShippingMethod { title?: string; extra?: Record<string, unknown>; }
export enum ECheckoutShippingMethodStyle {
    Default = 'default',
    Compact = 'compact',
    Cards = 'cards',
    Radio = 'radio',
    Minimal = 'minimal',
}
