import React, {useState} from 'react';

/**
 * Reusable magic-link request form. Extracted from the original
 * `/account/magic-link.tsx` page so the same UI can embed inside
 * `/account/signin` (magic-link-first UX), the order-by-token page,
 * or any custom Auth surface.
 *
 * POSTs to `/api/auth/magic-request` (W6c) — that endpoint mints a
 * single-use token, emails it, and the link returns to
 * `/account/verify?token=...` which calls `signIn('customer-magic')`.
 *
 * The form is intentionally minimal — no AntD or theme deps so the
 * component is bundle-safe to include on any storefront page.
 */
export const MagicLinkRequestForm: React.FC<{returnTo?: string; autoFocus?: boolean}> = ({returnTo, autoFocus}) => {
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch('/api/auth/magic-request', {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({email, returnTo}),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data?.error ?? `Failed: ${res.status}`);
            } else {
                setSent(true);
            }
        } catch (err) {
            setError(String((err as Error).message || err));
        } finally {
            setSubmitting(false);
        }
    };

    if (sent) {
        return (
            <div className="magic-link-sent" data-testid="magic-link-sent">
                Check your email — we sent a sign-in link to <strong>{email}</strong>.
            </div>
        );
    }

    return (
        <form onSubmit={onSubmit} className="magic-link-form" data-testid="magic-link-form">
            <label>
                Email
                <input
                    type="email"
                    autoComplete="email"
                    autoFocus={autoFocus}
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    data-testid="magic-link-email-input"
                />
            </label>
            {error ? <div role="alert" className="magic-link-error" data-testid="magic-link-error">{error}</div> : null}
            <button type="submit" disabled={submitting} data-testid="magic-link-submit">
                {submitting ? 'Sending…' : 'Email me a sign-in link'}
            </button>
        </form>
    );
};

export default MagicLinkRequestForm;
