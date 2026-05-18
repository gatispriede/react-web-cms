export interface IPlaceOrderButton { label?: string; extra?: Record<string, unknown>; }
export enum EPlaceOrderButtonStyle {
    Default = 'default',
    Compact = 'compact',
    Wide = 'wide',
    Floating = 'floating',
    Pill = 'pill',
}
