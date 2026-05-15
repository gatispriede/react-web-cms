import React, {useCallback, useState} from 'react';
import type {MagicLinkRequestFormProps} from './MagicLinkRequestForm.types';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const MagicLinkRequestForm: React.FC<MagicLinkRequestFormProps> = ({
    testId,
    onSubmit,
    headline = 'Sign in with a magic link',
    body = 'We\'ll email you a one-click sign-in link.',
    placeholder = 'you@example.com',
    submitLabel = 'Email me a link',
    successHeadline = 'Check your inbox',
    successBody = 'If we have an account for that email, a sign-in link is on its way.',
}) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (!EMAIL_RE.test(trimmed)) {
            setError('Please enter a valid email address.');
            return;
        }
        setError(null);
        setBusy(true);
        try {
            const result = await onSubmit(trimmed);
            if (result.sent) {
                setSent(true);
            } else {
                setError(result.error);
            }
        } finally {
            setBusy(false);
        }
    }, [email, onSubmit]);

    if (sent) {
        return (
            <div
                className="magic-link-request-form magic-link-request-form--success"
                data-testid={`${testId}-success`}
                role="status"
            >
                <h3 className="magic-link-request-form__headline">{successHeadline}</h3>
                <p className="magic-link-request-form__body">{successBody}</p>
            </div>
        );
    }

    return (
        <form
            className="magic-link-request-form"
            data-testid={testId}
            onSubmit={handleSubmit}
            noValidate
        >
            <h3 className="magic-link-request-form__headline">{headline}</h3>
            <p className="magic-link-request-form__body">{body}</p>
            <label className="magic-link-request-form__label" htmlFor={`${testId}-email-input`}>
                Email
            </label>
            <input
                id={`${testId}-email-input`}
                className="magic-link-request-form__input"
                type="email"
                autoComplete="email"
                required
                placeholder={placeholder}
                value={email}
                onChange={e => setEmail(e.target.value)}
                data-testid={`${testId}-email`}
                disabled={busy}
            />
            {error ? (
                <p
                    className="magic-link-request-form__error"
                    data-testid={`${testId}-error`}
                    role="alert"
                >{error}</p>
            ) : null}
            <button
                type="submit"
                className="magic-link-request-form__submit"
                data-testid={`${testId}-submit`}
                disabled={busy}
            >{busy ? 'Sending...' : submitLabel}</button>
        </form>
    );
};

export default MagicLinkRequestForm;
export {MagicLinkRequestForm};
