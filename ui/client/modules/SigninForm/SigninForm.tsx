import React, {useCallback, useState} from 'react';
import OauthButtonStack from '@client/modules/OauthButtonStack/OauthButtonStack';
import type {OauthProvider} from '@client/modules/OauthButtonStack/OauthButtonStack.types';
import type {SigninFormProps, SigninFormResult} from './SigninForm.types';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const SigninForm: React.FC<SigninFormProps> = ({
    testId,
    authMethods,
    onSubmit,
    onOauthChoose,
    forgotHref,
    signupHref,
    headline = 'Sign in',
    submitLabel = 'Sign in',
}) => {
    const showPassword = !!authMethods.password;
    const showMagicLinkToggle = !!authMethods.magicLink;
    const oauthProviders = authMethods.oauth ?? [];

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [magicMode, setMagicMode] = useState(!showPassword && showMagicLinkToggle);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<SigninFormResult | null>(null);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email.trim();
        if (!EMAIL_RE.test(trimmedEmail)) {
            setError('Please enter a valid email address.');
            return;
        }
        if (!magicMode && showPassword && password.length < 1) {
            setError('Please enter your password.');
            return;
        }
        setError(null);
        setBusy(true);
        try {
            const submission = magicMode
                ? {email: trimmedEmail}
                : {email: trimmedEmail, password: showPassword ? password : undefined};
            const res = await onSubmit(submission);
            if (res.ok) {
                setResult(res);
            } else {
                setError(res.error);
            }
        } finally {
            setBusy(false);
        }
    }, [email, password, magicMode, showPassword, onSubmit]);

    const handleOauthChoose = useCallback((provider: OauthProvider) => {
        if (onOauthChoose) onOauthChoose(provider);
    }, [onOauthChoose]);

    if (result) {
        const successMessage = result.next === 'magic-link-sent'
            ? 'Check your inbox for a sign-in link.'
            : 'You are signed in.';
        return (
            <div
                className="signin-form signin-form--success"
                data-testid={`${testId}-success`}
                role="status"
            >
                <h3 className="signin-form__headline">Welcome back</h3>
                <p className="signin-form__body">{successMessage}</p>
            </div>
        );
    }

    const showDivider = oauthProviders.length > 0 || (showMagicLinkToggle && showPassword);

    return (
        <form
            className="signin-form"
            data-testid={testId}
            onSubmit={handleSubmit}
            noValidate
        >
            <h3 className="signin-form__headline">{headline}</h3>

            <label className="signin-form__label" htmlFor={`${testId}-email-input`}>Email</label>
            <input
                id={`${testId}-email-input`}
                className="signin-form__input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                data-testid={`${testId}-email`}
                disabled={busy}
            />

            {!magicMode && showPassword ? (
                <>
                    <label className="signin-form__label" htmlFor={`${testId}-password-input`}>Password</label>
                    <input
                        id={`${testId}-password-input`}
                        className="signin-form__input"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        data-testid={`${testId}-password`}
                        disabled={busy}
                    />
                    {forgotHref ? (
                        <a
                            className="signin-form__forgot"
                            href={forgotHref}
                            data-testid={`${testId}-forgot-link`}
                        >Forgot password?</a>
                    ) : null}
                </>
            ) : null}

            {error ? (
                <p
                    className="signin-form__error"
                    data-testid={`${testId}-error`}
                    role="alert"
                >{error}</p>
            ) : null}

            <button
                type="submit"
                className="signin-form__submit"
                data-testid={`${testId}-submit`}
                disabled={busy}
            >{busy ? 'Submitting...' : (magicMode ? 'Email me a sign-in link' : submitLabel)}</button>

            {showMagicLinkToggle && showPassword ? (
                <button
                    type="button"
                    className="signin-form__link-btn"
                    data-testid={`${testId}-magic-link-toggle`}
                    onClick={() => { setMagicMode(m => !m); setError(null); }}
                    disabled={busy}
                >{magicMode ? 'Use password instead' : 'Get a magic link instead'}</button>
            ) : null}

            {showDivider ? (
                <div className="signin-form__divider" aria-hidden>
                    <span>or</span>
                </div>
            ) : null}

            {oauthProviders.length > 0 ? (
                <OauthButtonStack
                    testId={`${testId}-oauth`}
                    providers={oauthProviders}
                    onChoose={handleOauthChoose}
                />
            ) : null}

            {signupHref ? (
                <a
                    className="signin-form__signup"
                    href={signupHref}
                    data-testid={`${testId}-signup-link`}
                >Need an account? Sign up</a>
            ) : null}
        </form>
    );
};

export default SigninForm;
export {SigninForm};
