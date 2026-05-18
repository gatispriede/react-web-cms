import type {OauthProvider} from '@client/modules/OauthButtonStack/OauthButtonStack.types';

export interface SignupFormSubmission {
    email: string;
    password?: string;
    name: string;
    customerType?: 'client' | 'company';
    companyName?: string;
    vatId?: string;
    ref?: string;
    utmSource?: string;
}

export interface SignupFormResult {
    ok: true;
    next: 'verify-email-sent' | 'magic-link-sent';
}

export interface SignupFormProps {
    testId: string;
    authMethods: {
        password?: boolean;
        magicLink?: boolean;
        oauth?: OauthProvider[];
    };
    allowB2B?: boolean;
    onSubmit: (submission: SignupFormSubmission) => Promise<SignupFormResult | {ok: false; error: string}>;
    onOauthChoose?: (provider: OauthProvider) => void;
    headline?: string;
    submitLabel?: string;
    signinHref?: string;
}
