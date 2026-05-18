export interface ICartActions { title?: string; clearLabel?: string; proceedLabel?: string; extra?: Record<string, unknown>; }
export enum ECartActionsStyle {
    Default = 'default',
    Compact = 'compact',
    Pills = 'pills',
    Stacked = 'stacked',
    Floating = 'floating',
}
