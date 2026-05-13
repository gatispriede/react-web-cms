import React, {useCallback, useState} from 'react';
import type {MagicLinkConfirmationProps} from './MagicLinkConfirmation.types';

const MagicLinkConfirmation: React.FC<MagicLinkConfirmationProps> = ({
    testId,
    token,
    onConfirm,
    headline = 'One last step',
    body = 'Click below to finish signing in.',
    confirmLabel = 'Continue to my account',
    successLabel = 'Signed in — redirecting...',
}) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const handleClick = useCallback(async () => {
        if (!token) {
            setError('This sign-in link is missing or invalid.');
            return;
        }
        setError(null);
        setBusy(true);
        try {
            const result = await onConfirm(token);
            if (result.ok) {
                setDone(true);
            } else {
                setError(result.error);
            }
        } finally {
            setBusy(false);
        }
    }, [token, onConfirm]);

    return (
        <div className="magic-link-confirmation" data-testid={testId}>
            <h3 className="magic-link-confirmation__headline">{headline}</h3>
            <p className="magic-link-confirmation__body">{body}</p>
            {done ? (
                <p
                    className="magic-link-confirmation__success"
                    data-testid={`${testId}-success`}
                    role="status"
                >{successLabel}</p>
            ) : (
                <button
                    type="button"
                    className="magic-link-confirmation__confirm"
                    data-testid={`${testId}-confirm`}
                    onClick={handleClick}
                    disabled={busy}
                >{busy ? 'Signing in...' : confirmLabel}</button>
            )}
            {error ? (
                <p
                    className="magic-link-confirmation__error"
                    data-testid={`${testId}-error`}
                    role="alert"
                >{error}</p>
            ) : null}
        </div>
    );
};

export default MagicLinkConfirmation;
export {MagicLinkConfirmation};
