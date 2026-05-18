import type {OauthProvider} from '@client/modules/OauthButtonStack/OauthButtonStack.types';

export interface SigninFormSubmission {
    email: string;
    password?: string;
}

export interface SigninFormResult {
    ok: true;
    next: 'session-set' | 'magic-link-sent';
}

export interface SigninFormProps {
    testId: string;
    authMethods: {
        password?: boolean;
        magicLink?: boolean;
        oauth?: OauthProvider[];
    };
    onSubmit: (submission: SigninFormSubmission) => Promise<SigninFormResult | {ok: false; error: string}>;
    onOauthChoose?: (provider: OauthProvider) => void;
    forgotHref?: string;
    signupHref?: string;
    headline?: string;
    submitLabel?: string;
}
