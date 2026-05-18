/** CartLineItems content blob. Loose schema. */
export interface ICartLineItems {
    title?: string;
    body?: string;
    extra?: Record<string, unknown>;
}

export enum ECartLineItemsStyle {
    Default = 'default',
    Compact = 'compact',
    Cards = 'cards',
    Receipt = 'receipt',
    Bordered = 'bordered',
}
