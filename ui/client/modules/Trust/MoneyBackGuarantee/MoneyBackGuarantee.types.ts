export interface IMoneyBackGuarantee { title?: string; body?: string; extra?: Record<string, unknown>; }
export enum EMoneyBackGuaranteeStyle {
    Default = 'default',
    Compact = 'compact',
    Banner = 'banner',
    Card = 'card',
    Ribbon = 'ribbon',
}
