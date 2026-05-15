import React, {useCallback, useEffect, useRef, useState} from 'react';
import OauthButtonStack from '@client/modules/OauthButtonStack/OauthButtonStack';
import type {OauthProvider} from '@client/modules/OauthButtonStack/OauthButtonStack.types';
import type {SignupFormProps, SignupFormResult} from './SignupForm.types';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const VAT_RE = /^[A-Z]{2}[A-Z0-9]{2,12}$/i;

const SignupForm: React.FC<SignupFormProps> = ({
    testId,
    authMethods,
    allowB2B,
    onSubmit,
    onOauthChoose,
    headline = 'Create your account',
    submitLabel = 'Create account',
    signinHref,
}) => {
    const showPassword = !!authMethods.password;
    const showMagicLinkToggle = !!authMethods.magicLink;
    const oauthProviders = authMethods.oauth ?? [];

    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [isB2B, setIsB2B] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [vatId, setVatId] = useState('');
    const [magicMode, setMagicMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<SignupFormResult | null>(null);

    const attribution = useRef<{ref?: string; utmSource?: string}>({});

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        attribution.current = {
            ref: params.get('ref') ?? undefined,
            utmSource: params.get('utm_source') ?? undefined,
        };
    }, []);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email.trim();
        const trimmedName = name.trim();
        if (!EMAIL_RE.test(trimmedEmail)) {
            setError('Please enter a valid email address.');
            return;
        }
        if (!magicMode && !trimmedName) {
            setError('Please enter your name.');
            return;
        }
        if (!magicMode && showPassword && password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (!magicMode && isB2B) {
            if (!companyName.trim()) {
                setError('Please enter your company name.');
                return;
            }
            if (!VAT_RE.test(vatId.trim())) {
                setError('Please enter a valid VAT id.');
                return;
            }
        }
        setError(null);
        setBusy(true);
        try {
            const submission = magicMode
                ? {
                    email: trimmedEmail,
                    name: trimmedName || trimmedEmail,
                    ref: attribution.current.ref,
                    utmSource: attribution.current.utmSource,
                }
                : {
                    email: trimmedEmail,
                    name: trimmedName,
                    password: showPassword ? password : undefined,
                    customerType: isB2B ? ('company' as const) : ('client' as const),
                    companyName: isB2B ? companyName.trim() : undefined,
                    vatId: isB2B ? vatId.trim() : undefined,
                    ref: attribution.current.ref,
                    utmSource: attribution.current.utmSource,
                };
            const res = await onSubmit(submission);
            if (res.ok) {
                setResult(res);
            } else {
                setError(res.error);
            }
        } finally {
            setBusy(false);
        }
    }, [email, name, password, isB2B, companyName, vatId, magicMode, showPassword, onSubmit]);

    const handleOauthChoose = useCallback((provider: OauthProvider) => {
        if (onOauthChoose) onOauthChoose(provider);
    }, [onOauthChoose]);

    if (result) {
        const successMessage = result.next === 'magic-link-sent'
            ? 'Check your inbox for a sign-in link.'
            : 'Check your inbox to verify your email.';
        return (
            <div
                className="signup-form signup-form--success"
                data-testid={`${testId}-success`}
                role="status"
            >
                <h3 className="signup-form__headline">You&apos;re nearly there</h3>
                <p className="signup-form__body">{successMessage}</p>
            </div>
        );
    }

    const showDivider = !magicMode && (oauthProviders.length > 0 || showMagicLinkToggle);

    return (
        <form
            className="signup-form"
            data-testid={testId}
            onSubmit={handleSubmit}
            noValidate
        >
            <h3 className="signup-form__headline">{headline}</h3>

            <label className="signup-form__label" htmlFor={`${testId}-email-input`}>Email</label>
            <input
                id={`${testId}-email-input`}
                className="signup-form__input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                data-testid={`${testId}-email`}
                disabled={busy}
            />

            {!magicMode ? (
                <>
                    <label className="signup-form__label" htmlFor={`${testId}-name-input`}>Name</label>
                    <input
                        id={`${testId}-name-input`}
                        className="signup-form__input"
                        type="text"
                        autoComplete="name"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        data-testid={`${testId}-name`}
                        disabled={busy}
                    />
                </>
            ) : null}

            {!magicMode && showPassword ? (
                <>
                    <label className="signup-form__label" htmlFor={`${testId}-password-input`}>Password</label>
                    <input
                        id={`${testId}-password-input`}
                        className="signup-form__input"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        data-testid={`${testId}-password`}
                        disabled={busy}
                    />
                </>
            ) : null}

            {!magicMode && allowB2B ? (
                <div className="signup-form__b2b">
                    <label className="signup-form__toggle">
                        <input
                            type="checkbox"
                            checked={isB2B}
                            onChange={e => setIsB2B(e.target.checked)}
                            data-testid={`${testId}-b2b-toggle`}
                            disabled={busy}
                        />
                        <span>I&apos;m buying for a business</span>
                    </label>
                    {isB2B ? (
                        <div className="signup-form__b2b-panel">
                            <label className="signup-form__label" htmlFor={`${testId}-company-input`}>Company name</label>
                            <input
                                id={`${testId}-company-input`}
                                className="signup-form__input"
                                type="text"
                                autoComplete="organization"
                                value={companyName}
                                onChange={e => setCompanyName(e.target.value)}
                                data-testid={`${testId}-company-name`}
                                disabled={busy}
                            />
                            <label className="signup-form__label" htmlFor={`${testId}-vat-input`}>VAT id</label>
                            <input
                                id={`${testId}-vat-input`}
                                className="signup-form__input"
                                type="text"
                                value={vatId}
                                onChange={e => setVatId(e.target.value)}
                                data-testid={`${testId}-vat-id`}
                                disabled={busy}
                            />
                        </div>
                    ) : null}
                </div>
            ) : null}

            {error ? (
                <p
                    className="signup-form__error"
                    data-testid={`${testId}-error`}
                    role="alert"
                >{error}</p>
            ) : null}

            <button
                type="submit"
                className="signup-form__submit"
                data-testid={`${testId}-submit`}
                disabled={busy}
            >{busy ? 'Submitting...' : (magicMode ? 'Email me a sign-in link' : submitLabel)}</button>

            {showMagicLinkToggle ? (
                <button
                    type="button"
                    className="signup-form__link-btn"
                    data-testid={`${testId}-magic-link-toggle`}
                    onClick={() => { setMagicMode(m => !m); setError(null); }}
                    disabled={busy}
                >{magicMode ? 'Use password instead' : 'Get a magic link instead'}</button>
            ) : null}

            {showDivider ? (
                <div className="signup-form__divider" aria-hidden>
                    <span>or</span>
                </div>
            ) : null}

            {!magicMode && oauthProviders.length > 0 ? (
                <OauthButtonStack
                    testId={`${testId}-oauth`}
                    providers={oauthProviders}
                    onChoose={handleOauthChoose}
                />
            ) : null}

            {signinHref ? (
                <a
                    className="signup-form__signin"
                    href={signinHref}
                    data-testid={`${testId}-signin-link`}
                >Sign in instead</a>
            ) : null}
        </form>
    );
};

export default SignupForm;
export {SignupForm};
