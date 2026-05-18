export interface IAccountWelcome { title?: string; extra?: Record<string, unknown>; }
export enum EAccountWelcomeStyle {
    Default = 'default',
    Compact = 'compact',
    Hero = 'hero',
    Editorial = 'editorial',
    Card = 'card',
}
