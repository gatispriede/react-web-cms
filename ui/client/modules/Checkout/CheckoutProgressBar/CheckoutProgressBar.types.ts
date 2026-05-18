export interface ICheckoutProgressBar { title?: string; extra?: Record<string, unknown>; }
export enum ECheckoutProgressBarStyle {
    Default = 'default',
    Compact = 'compact',
    Stepper = 'stepper',
    Bar = 'bar',
    Breadcrumb = 'breadcrumb',
}
