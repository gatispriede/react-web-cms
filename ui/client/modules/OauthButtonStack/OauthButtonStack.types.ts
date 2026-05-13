export type OauthProvider = 'google' | 'apple' | 'facebook';

export interface OauthButtonStackProps {
    testId: string;
    /** Caller initiates the OAuth dance with the selected provider. */
    onChoose: (provider: OauthProvider) => void;
    /** Last-used provider — pinned to position 0 when included. */
    lastUsed?: OauthProvider;
    /** Subset of providers to render — defaults to all 3. */
    providers?: OauthProvider[];
    /** Test/SSR override for the platform detection. */
    forcePlatform?: 'ios' | 'web';
}

export const PROVIDER_LABELS: Record<OauthProvider, string> = {
    google: 'Continue with Google',
    apple: 'Continue with Apple',
    facebook: 'Continue with Facebook',
};

export const WEB_ORDER: ReadonlyArray<OauthProvider> = ['google', 'apple', 'facebook'];
export const IOS_ORDER: ReadonlyArray<OauthProvider> = ['apple', 'google', 'facebook'];
